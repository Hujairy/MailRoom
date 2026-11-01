<#
.SYNOPSIS
  Creates the SharePoint list used by the Mail Room code app.

.DESCRIPTION
  Creates a list (default name "MailroomItems") with the columns the app
  expects, indexes the columns the app filters on, and sets up the default
  view. Safe to re-run: existing columns are skipped.

  Requires PowerShell 7.4+ and the PnP.PowerShell module:
    Install-Module PnP.PowerShell -Scope CurrentUser

  PnP.PowerShell needs an Entra ID app registration for interactive sign-in.
  If you don't have one, ask IT, or create it once with:
    Register-PnPEntraIDAppForInteractiveLogin -ApplicationName "PnP PowerShell" -Tenant contoso.onmicrosoft.com

.EXAMPLE
  ./Create-MailroomList.ps1 -SiteUrl https://contoso.sharepoint.com/sites/MailRoom -ClientId 00000000-0000-0000-0000-000000000000
#>
param(
  [Parameter(Mandatory = $true)] [string] $SiteUrl,
  [Parameter(Mandatory = $true)] [string] $ClientId,
  [string] $ListName = 'MailroomItems'
)

$ErrorActionPreference = 'Stop'
Import-Module PnP.PowerShell

Connect-PnPOnline -Url $SiteUrl -Interactive -ClientId $ClientId

$list = Get-PnPList -Identity $ListName -ErrorAction SilentlyContinue
if ($null -eq $list) {
  $list = New-PnPList -Title $ListName -Template GenericList -OnQuickLaunch
  Write-Host "Created list '$ListName'."
} else {
  Write-Host "List '$ListName' already exists. Adding any missing columns."
}

# The built-in Title column holds the courier number.
Set-PnPField -List $ListName -Identity 'Title' -Values @{ Title = 'Courier number' } | Out-Null

# Internal names must match COLUMNS in src/config.ts.
$fields = @(
  '<Field Type="Text" Name="Kind" StaticName="Kind" DisplayName="Kind" MaxLength="20" />',
  '<Field Type="Text" Name="Unit" StaticName="Unit" DisplayName="Unit" MaxLength="50" />',
  '<Field Type="Text" Name="CourierCompany" StaticName="CourierCompany" DisplayName="CourierCompany" MaxLength="100" />',
  '<Field Type="Text" Name="Sender" StaticName="Sender" DisplayName="Sender" MaxLength="255" />',
  '<Field Type="Text" Name="RecipientName" StaticName="RecipientName" DisplayName="RecipientName" MaxLength="255" />',
  '<Field Type="Text" Name="RecipientEmail" StaticName="RecipientEmail" DisplayName="RecipientEmail" MaxLength="255" />',
  '<Field Type="Text" Name="Department" StaticName="Department" DisplayName="Department" MaxLength="255" />',
  '<Field Type="Text" Name="Status" StaticName="Status" DisplayName="Status" MaxLength="20" />',
  '<Field Type="Text" Name="CollectedByName" StaticName="CollectedByName" DisplayName="CollectedByName" MaxLength="255" />',
  '<Field Type="Text" Name="CollectedByEmail" StaticName="CollectedByEmail" DisplayName="CollectedByEmail" MaxLength="255" />',
  '<Field Type="DateTime" Name="CollectedOn" StaticName="CollectedOn" DisplayName="CollectedOn" Format="DateTime" />',
  '<Field Type="Text" Name="LoggedByName" StaticName="LoggedByName" DisplayName="LoggedByName" MaxLength="255" />',
  '<Field Type="Text" Name="LoggedByEmail" StaticName="LoggedByEmail" DisplayName="LoggedByEmail" MaxLength="255" />',
  '<Field Type="Note" Name="Notes" StaticName="Notes" DisplayName="Notes" NumLines="3" RichText="FALSE" />'
)

foreach ($xml in $fields) {
  $name = ([xml]$xml).Field.Name
  if ($null -ne (Get-PnPField -List $ListName -Identity $name -ErrorAction SilentlyContinue)) {
    Write-Host "  Column '$name' exists, skipped."
    continue
  }
  Add-PnPFieldFromXml -List $ListName -FieldXml $xml | Out-Null
  Write-Host "  Added column '$name'."
}

# The app filters on these; indexes keep it working past 5,000 items.
foreach ($name in @('Unit', 'Status', 'Kind', 'RecipientEmail')) {
  Set-PnPField -List $ListName -Identity $name -Values @{ Indexed = $true } | Out-Null
}
Write-Host "Indexed Unit, Status, Kind and RecipientEmail."

$view = Get-PnPView -List $ListName | Where-Object { $_.DefaultView } | Select-Object -First 1
if ($null -ne $view) {
  Set-PnPView -List $ListName -Identity $view.Id -Fields @(
    'Title', 'Kind', 'Unit', 'CourierCompany', 'Sender', 'RecipientName', 'Department',
    'Status', 'CollectedByName', 'CollectedOn', 'Created'
  ) | Out-Null
  Write-Host "Updated the default view."
}

Write-Host ""
Write-Host "Done. Next: pa app add data-source --connector `"shared_sharepointonline`" --connection-id <id> --dataset `"$SiteUrl`" --table `"$ListName`""
