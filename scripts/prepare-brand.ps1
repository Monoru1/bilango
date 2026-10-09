# Couches Android dérivées du SVG officiel. Les PNG de logo complet restent inchangés.
Add-Type -AssemblyName System.Drawing
$assetRoot = Join-Path $PSScriptRoot '../assets/images'
foreach ($mode in @('foreground', 'monochrome', 'background')) {
  $bitmap = [System.Drawing.Bitmap]::new(1024, 1024)
  $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
  $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $graphics.Clear([System.Drawing.Color]::Transparent)
  if ($mode -eq 'background') {
    $graphics.Clear([System.Drawing.ColorTranslator]::FromHtml('#25D366'))
  } else {
    $graphics.TranslateTransform(166.4, 166.4)
    $graphics.ScaleTransform(1.35, 1.35)
    $ink = if ($mode -eq 'monochrome') { '#FFFFFF' } else { '#085041' }
    $brush = [System.Drawing.SolidBrush]::new([System.Drawing.ColorTranslator]::FromHtml($ink))
    $graphics.FillRectangle($brush, 128, 304, 45, 100)
    $graphics.FillRectangle($brush, 188, 250, 45, 154)
    $graphics.FillRectangle($brush, 247, 189, 45, 215)
    $pen = [System.Drawing.Pen]::new([System.Drawing.Color]::White, 31)
    $graphics.DrawEllipse($pen, 134.5, 107.5, 255, 255)
    $pen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
    $pen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
    $graphics.DrawLine($pen, 352.2, 325.2, 411.5, 384.5)
    $pen.Dispose()
    $brush.Dispose()
  }
  $bitmap.Save((Join-Path $assetRoot "android-icon-$mode.png"), [System.Drawing.Imaging.ImageFormat]::Png)
  $graphics.Dispose()
  $bitmap.Dispose()
}

# Composition splash distincte, à partir du PNG client sans recoloration.
$splashBitmap = [System.Drawing.Bitmap]::new(1024, 1024)
$splashGraphics = [System.Drawing.Graphics]::FromImage($splashBitmap)
$splashGraphics.Clear([System.Drawing.Color]::Transparent)
$splashGraphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$officialLogo = [System.Drawing.Bitmap]::new((Join-Path $assetRoot 'icon.png'))
$splashGraphics.DrawImage($officialLogo, 128, 128, 768, 768)
$splashBitmap.Save((Join-Path $assetRoot 'splash-icon.png'), [System.Drawing.Imaging.ImageFormat]::Png)
$officialLogo.Dispose()
$splashGraphics.Dispose()
$splashBitmap.Dispose()
