<#
.SYNOPSIS
  Creates the two SharePoint lists used by the Mail Room code app:
  PersonalMail and DepartmentMail, with the same fields as the original
  Bahrain Mail Room site.

.DESCRIPTION
  Safe to re-run: existing lists and columns are skipped. Column internal
  names have no spaces (they must match src/config.ts); display names match
  the original site, e.g. "Courier Company".

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
  [Parameter(Mandatory = $true)] [string] $ClientId
)

$ErrorActionPreference = 'Stop'
Import-Module PnP.PowerShell
Connect-PnPOnline -Url $SiteUrl -Interactive -ClientId $ClientId

function Text($name, $display, $length = 255) {
  "<Field Type=`"Text`" Name=`"$name`" StaticName=`"$name`" DisplayName=`"$display`" MaxLength=`"$length`" />"
}
function Stamp($name, $display) {
  "<Field Type=`"DateTime`" Name=`"$name`" StaticName=`"$name`" DisplayName=`"$display`" Format=`"DateTime`" />"
}

$lists = @(
  @{
    Name    = 'PersonalMail'
    Fields  = @(
      (Text 'CourierCompany' 'Courier Company' 100),
      (Text 'Sender' 'Sender'),
      (Text 'Recipient' 'Recipient'),
      (Text 'RecipientEmail' 'Recipient Email'),
      (Text 'OnBehalf' 'On Behalf'),
      (Text 'Unit' 'Unit' 50),
      (Text 'Received' 'Received' 3),
      (Text 'ReceivedBy' 'Received By'),
      (Text 'ReceivedByEmail' 'Received By Email'),
      (Stamp 'ReceivedTimeStamp' 'Received Time Stamp')
    )
    Indexed = @('Unit', 'Received', 'RecipientEmail')
    View    = @('ID', 'Title', 'CourierCompany', 'Sender', 'Recipient', 'OnBehalf', 'Created', 'Author', 'Received', 'ReceivedBy', 'ReceivedTimeStamp')
  },
  @{
    Name    = 'DepartmentMail'
    Fields  = @(
      (Text 'CourierCompany' 'Courier Company' 100),
      (Text 'Department' 'Department'),
      (Text 'SenderCompany' 'Sender Company'),
      (Text 'Unit' 'Unit' 50),
      (Text 'Received' 'Received' 3),
      (Text 'ReceivedBy' 'Received By'),
      (Text 'ReceivedByEmail' 'Received By Email'),
      (Stamp 'ReceivedTimeStamp' 'Received Time Stamp')
    )
    Indexed = @('Unit', 'Received')
    View    = @('ID', 'Title', 'CourierCompany', 'Department', 'SenderCompany', 'Created', 'Author', 'Received', 'ReceivedBy', 'ReceivedTimeStamp')
  }
)

foreach ($def in $lists) {
  $name = $def.Name
  if ($null -eq (Get-PnPList -Identity $name -ErrorAction SilentlyContinue)) {
    New-PnPList -Title $name -Template GenericList -OnQuickLaunch | Out-Null
    Write-Host "Created list '$name'."
  } else {
    Write-Host "List '$name' already exists. Adding any missing columns."
  }

  # The built-in Title column holds the courier number.
  Set-PnPField -List $name -Identity 'Title' -Values @{ Title = 'Courier Number' } | Out-Null

  foreach ($xml in $def.Fields) {
    $field = ([xml]$xml).Field.Name
    if ($null -ne (Get-PnPField -List $name -Identity $field -ErrorAction SilentlyContinue)) {
      Write-Host "  Column '$field' exists, skipped."
      continue
    }
    Add-PnPFieldFromXml -List $name -FieldXml $xml | Out-Null
    Write-Host "  Added column '$field'."
  }

  # The app filters on these; indexes keep it working past 5,000 items.
  foreach ($field in $def.Indexed) {
    Set-PnPField -List $name -Identity $field -Values @{ Indexed = $true } | Out-Null
  }

  $view = Get-PnPView -List $name | Where-Object { $_.DefaultView } | Select-Object -First 1
  if ($null -ne $view) {
    Set-PnPView -List $name -Identity $view.Id -Fields $def.View | Out-Null
  }
  Write-Host "List '$name' is ready."
}

Write-Host ""
Write-Host "Next, add both lists to the app (see README):"
Write-Host "  pa app add data-source --connector `"shared_sharepointonline`" --connection-id <id> --dataset `"$SiteUrl`" --table `"PersonalMail`""
Write-Host "  pa app add data-source --connector `"shared_sharepointonline`" --connection-id <id> --dataset `"$SiteUrl`" --table `"DepartmentMail`""
