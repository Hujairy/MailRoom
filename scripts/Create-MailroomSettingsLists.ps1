<#
.SYNOPSIS
  Creates the two Mail Room settings lists, used by the app's Settings page:
  MailroomUnits (one item per unit) and MailroomMembers (who is in which
  unit, as an Admin or a User).

.DESCRIPTION
  Run it once, on a site that every Mail Room user can read but only the
  general admins can edit, for example a "Mail Room Settings" site where
  everyone is a Visitor and the general admins are Owners. If people could
  edit these lists directly in SharePoint, they could add themselves to a
  unit or make themselves an admin.

  Safe to re-run: existing lists and columns are skipped.

  Requires PowerShell 7.4+ and the PnP.PowerShell module:
    Install-Module PnP.PowerShell -Scope CurrentUser

.EXAMPLE
  ./Create-MailroomSettingsLists.ps1 -SiteUrl https://contoso.sharepoint.com/sites/MailRoom-Settings -ClientId 00000000-0000-0000-0000-000000000000
#>
param(
  [Parameter(Mandatory = $true)] [string] $SiteUrl,
  [Parameter(Mandatory = $true)] [string] $ClientId
)

$ErrorActionPreference = 'Stop'
Import-Module PnP.PowerShell
Connect-PnPOnline -Url $SiteUrl -Interactive -ClientId $ClientId

function Text($name, $display, $length = 255) {
  "<Field Type=`"Text`" Name=`"$name`" StaticName=`"$name`" DisplayName=`"$display`" MaxLength=`"$length`" />"
}

$lists = @(
  @{
    Name   = 'MailroomUnits'
    Title  = 'Unit'
    Fields = @()
    View   = @('Title')
  },
  @{
    Name   = 'MailroomMembers'
    Title  = 'Email'
    Fields = @(
      (Text 'MemberName' 'Name'),
      (Text 'Unit' 'Unit' 100),
      (Text 'Role' 'Role' 10)
    )
    View   = @('Title', 'MemberName', 'Unit', 'Role')
  }
)

foreach ($def in $lists) {
  $name = $def.Name
  if ($null -eq (Get-PnPList -Identity $name -ErrorAction SilentlyContinue)) {
    New-PnPList -Title $name -Template GenericList | Out-Null
    Write-Host "Created list '$name'."
  } else {
    Write-Host "List '$name' already exists. Adding any missing columns."
  }

  Set-PnPField -List $name -Identity 'Title' -Values @{ Title = $def.Title } | Out-Null

  foreach ($xml in $def.Fields) {
    $field = ([xml]$xml).Field.Name
    if ($null -ne (Get-PnPField -List $name -Identity $field -ErrorAction SilentlyContinue)) {
      Write-Host "  Column '$field' exists, skipped."
      continue
    }
    Add-PnPFieldFromXml -List $name -FieldXml $xml | Out-Null
    Write-Host "  Added column '$field'."
  }

  $view = Get-PnPView -List $name | Where-Object { $_.DefaultView } | Select-Object -First 1
  if ($null -ne $view) {
    Set-PnPView -List $name -Identity $view.Id -Fields $def.View | Out-Null
  }
  Write-Host "List '$name' is ready."
}

Write-Host ""
Write-Host "Next (see README):"
Write-Host "  1. Make sure everyone who uses the app can read this site, and only the general admins can edit it."
Write-Host "  2. Add both lists to the app:"
Write-Host "     pa app add data-source --connector `"shared_sharepointonline`" --connection-id <id> --dataset `"$SiteUrl`" --table `"MailroomUnits`""
Write-Host "     pa app add data-source --connector `"shared_sharepointonline`" --connection-id <id> --dataset `"$SiteUrl`" --table `"MailroomMembers`""
Write-Host "  3. npm run build, then pa app push. Open the app and use Settings to add units and people."
