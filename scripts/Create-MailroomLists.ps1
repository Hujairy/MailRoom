<#
.SYNOPSIS
  Creates one unit's two SharePoint lists for the Mail Room code app:
  <Unit>PersonalMail and <Unit>DepartmentMail (e.g. BahrainPersonalMail),
  with the same fields as the original Bahrain Mail Room site.

.DESCRIPTION
  Run it once per unit, ideally on that unit's own site (for example
  /sites/MailRoom/Bahrain), and give only that unit's people access to the
  site. That's what keeps each unit's records apart. -Unit is the unit's
  name from the app's Settings page without spaces (Saudi Arabia becomes
  SaudiArabia); the Settings page shows the exact command.

  Safe to re-run: existing lists and columns are skipped. Column internal
  names have no spaces (they must match src/config.ts); display names match
  the original site, e.g. "Courier Company".

  Requires PowerShell 7.4+ and the PnP.PowerShell module:
    Install-Module PnP.PowerShell -Scope CurrentUser

  PnP.PowerShell needs an Entra ID app registration for interactive sign-in.
  If you don't have one, ask IT, or create it once with:
    Register-PnPEntraIDAppForInteractiveLogin -ApplicationName "PnP PowerShell" -Tenant contoso.onmicrosoft.com

.EXAMPLE
  ./Create-MailroomLists.ps1 -Unit Bahrain -SiteUrl https://contoso.sharepoint.com/sites/MailRoom-Bahrain -ClientId 00000000-0000-0000-0000-000000000000
#>
param(
  [Parameter(Mandatory = $true)] [ValidatePattern('^[A-Za-z0-9]+$')] [string] $Unit,
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
    Name    = "${Unit}PersonalMail"
    Fields  = @(
      (Text 'CourierCompany' 'Courier Company' 100),
      (Text 'Sender' 'Sender'),
      (Text 'Recipient' 'Recipient'),
      (Text 'RecipientEmail' 'Recipient Email'),
      (Text 'OnBehalf' 'On Behalf'),
      (Text 'Received' 'Received' 3),
      (Text 'ReceivedBy' 'Received By'),
      (Text 'ReceivedByEmail' 'Received By Email'),
      (Stamp 'ReceivedTimeStamp' 'Received Time Stamp')
    )
    Indexed = @('Received', 'RecipientEmail')
    View    = @('ID', 'Title', 'CourierCompany', 'Sender', 'Recipient', 'OnBehalf', 'Created', 'Author', 'Received', 'ReceivedBy', 'ReceivedTimeStamp')
  },
  @{
    Name    = "${Unit}DepartmentMail"
    Fields  = @(
      (Text 'CourierCompany' 'Courier Company' 100),
      (Text 'Department' 'Department'),
      (Text 'SenderCompany' 'Sender Company'),
      (Text 'Received' 'Received' 3),
      (Text 'ReceivedBy' 'Received By'),
      (Text 'ReceivedByEmail' 'Received By Email'),
      (Stamp 'ReceivedTimeStamp' 'Received Time Stamp')
    )
    Indexed = @('Received')
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
Write-Host "Next (see README):"
Write-Host "  1. Give only the $Unit team access to this site (or these two lists)."
Write-Host "  2. Add the lists to the app:"
Write-Host "     pa app add data-source --connector `"shared_sharepointonline`" --connection-id <id> --dataset `"$SiteUrl`" --table `"${Unit}PersonalMail`""
Write-Host "     pa app add data-source --connector `"shared_sharepointonline`" --connection-id <id> --dataset `"$SiteUrl`" --table `"${Unit}DepartmentMail`""
Write-Host "  3. npm run build, then pa app push. Add the $Unit unit and its people in the app's Settings page if you haven't yet."
