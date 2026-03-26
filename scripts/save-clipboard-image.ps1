param(
  [string]$Path = "tmp/screenshots/latest.png",
  [switch]$Timestamped
)

$repoRoot = Split-Path -Parent $PSScriptRoot

if ([System.Threading.Thread]::CurrentThread.ApartmentState -ne "STA") {
  $args = @(
    "-NoProfile",
    "-STA",
    "-ExecutionPolicy", "Bypass",
    "-File", "`"$PSCommandPath`"",
    "-Path", "`"$Path`""
  )

  if ($Timestamped) {
    $args += "-Timestamped"
  }

  $process = Start-Process -FilePath "powershell.exe" -ArgumentList $args -Wait -PassThru
  exit $process.ExitCode
}

Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

$image = [System.Windows.Forms.Clipboard]::GetImage()
if (-not $image) {
  Write-Error "Clipboard does not contain an image."
  exit 1
}

$targetPath = $Path
if (-not [System.IO.Path]::IsPathRooted($targetPath)) {
  $targetPath = Join-Path $repoRoot $targetPath
}

$targetDirectory = Split-Path -Parent $targetPath
$targetFileName = [System.IO.Path]::GetFileNameWithoutExtension($targetPath)
$targetExtension = [System.IO.Path]::GetExtension($targetPath)

if ([string]::IsNullOrWhiteSpace($targetExtension)) {
  $targetExtension = ".png"
}

if ($Timestamped) {
  $stamp = Get-Date -Format "yyyyMMdd-HHmmss"
  $targetPath = Join-Path $targetDirectory "$targetFileName-$stamp$targetExtension"
}

if (-not (Test-Path $targetDirectory)) {
  New-Item -ItemType Directory -Path $targetDirectory -Force | Out-Null
}

$bitmap = New-Object System.Drawing.Bitmap $image.Width, $image.Height
$graphics = [System.Drawing.Graphics]::FromImage($bitmap)

try {
  $graphics.DrawImage($image, 0, 0, $image.Width, $image.Height)

  if (Test-Path $targetPath) {
    Remove-Item $targetPath -Force
  }

  $stream = [System.IO.File]::Open($targetPath, [System.IO.FileMode]::CreateNew, [System.IO.FileAccess]::Write, [System.IO.FileShare]::None)
  try {
    $bitmap.Save($stream, [System.Drawing.Imaging.ImageFormat]::Png)
  }
  finally {
    $stream.Dispose()
  }

  $promptText = "latest-shot"
  Set-Clipboard -Value $promptText
  Write-Output $targetPath
  Write-Output $promptText
}
finally {
  $graphics.Dispose()
  $bitmap.Dispose()
  $image.Dispose()
}
