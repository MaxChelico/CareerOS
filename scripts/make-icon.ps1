# Draws the CareerOS icon. Usage: powershell -File scripts/make-icon.ps1 -OutIco careeros.ico -PreviewPng preview-256.png
# Then copy careeros.ico to src/app/favicon.ico as well.
param([string]$OutIco, [string]$PreviewPng)
Add-Type -AssemblyName System.Drawing

# Draw the icon at one size and return PNG bytes.
function Draw([int]$s) {
  $bmp = New-Object System.Drawing.Bitmap $s, $s
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode = 'AntiAlias'
  $g.Clear([System.Drawing.Color]::Transparent)

  # Rounded dark square (slate-900)
  $r = [single]($s * 0.22)
  $path = New-Object System.Drawing.Drawing2D.GraphicsPath
  $w = [single]($s - 1)
  $path.AddArc(0, 0, 2*$r, 2*$r, 180, 90)
  $path.AddArc($w - 2*$r, 0, 2*$r, 2*$r, 270, 90)
  $path.AddArc($w - 2*$r, $w - 2*$r, 2*$r, 2*$r, 0, 90)
  $path.AddArc(0, $w - 2*$r, 2*$r, 2*$r, 90, 90)
  $path.CloseFigure()
  $g.FillPath((New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 15, 23, 42))), $path)

  # Sky-blue "C": a thick arc open on the right (sky-500)
  $stroke = [single]($s * 0.14)
  $pen = New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(255, 14, 165, 233)), $stroke
  $pen.StartCap = 'Round'; $pen.EndCap = 'Round'
  $m = [single]($s * 0.24)
  $g.DrawArc($pen, $m, $m, [single]($s - 2*$m), [single]($s - 2*$m), 45, 270)

  # White rising arrow inside the C (skipped at 16px, where it would blur)
  if ($s -ge 24) {
    $aw = [single]($s * 0.075)
    $apen = New-Object System.Drawing.Pen ([System.Drawing.Color]::White), $aw
    $apen.StartCap = 'Round'; $apen.EndCap = 'Round'; $apen.LineJoin = 'Round'
    $x1 = [single]($s * 0.39); $y1 = [single]($s * 0.63)
    $x2 = [single]($s * 0.58); $y2 = [single]($s * 0.44)
    $g.DrawLine($apen, $x1, $y1, $x2, $y2)
    $h = [single]($s * 0.12)
    $g.DrawLines($apen, [System.Drawing.PointF[]]@(
      (New-Object System.Drawing.PointF ($x2 - $h), $y2),
      (New-Object System.Drawing.PointF $x2, $y2),
      (New-Object System.Drawing.PointF $x2, ($y2 + $h))))
  }

  $g.Dispose()
  $ms = New-Object System.IO.MemoryStream
  $bmp.Save($ms, [System.Drawing.Imaging.ImageFormat]::Png)
  $bmp.Dispose()
  return ,$ms.ToArray()
}

# Assemble a multi-size .ico (PNG-compressed entries, supported since Windows Vista).
$sizes = 256, 64, 48, 32, 24, 16
$images = foreach ($sz in $sizes) { ,(Draw $sz) }
$out = New-Object System.IO.MemoryStream
$bw = New-Object System.IO.BinaryWriter $out
$bw.Write([UInt16]0); $bw.Write([UInt16]1); $bw.Write([UInt16]$sizes.Count)
$offset = 6 + 16 * $sizes.Count
for ($i = 0; $i -lt $sizes.Count; $i++) {
  $dim = if ($sizes[$i] -ge 256) { 0 } else { $sizes[$i] }
  $bw.Write([byte]$dim); $bw.Write([byte]$dim); $bw.Write([byte]0); $bw.Write([byte]0)
  $bw.Write([UInt16]1); $bw.Write([UInt16]32)
  $bw.Write([UInt32]$images[$i].Length); $bw.Write([UInt32]$offset)
  $offset += $images[$i].Length
}
foreach ($img in $images) { $bw.Write($img) }
[System.IO.File]::WriteAllBytes($OutIco, $out.ToArray())
[System.IO.File]::WriteAllBytes($PreviewPng, $images[0])
"Wrote $OutIco ($((Get-Item $OutIco).Length) bytes, sizes: $($sizes -join ', '))"

# Preview strip: each size drawn at 4x (nearest-neighbour) so small sizes can be inspected.
$strip = New-Object System.Drawing.Bitmap 520, 140
$sg = [System.Drawing.Graphics]::FromImage($strip)
$sg.Clear([System.Drawing.Color]::FromArgb(255, 241, 245, 249))
$sg.InterpolationMode = 'NearestNeighbor'
$x = 10
foreach ($sz in 48, 32, 24, 16) {
  $img = [System.Drawing.Image]::FromStream((New-Object System.IO.MemoryStream (,(Draw $sz))))
  $scale = [int](120 / $sz) ; if ($scale -gt 4) { $scale = 4 }
  $sg.DrawImage($img, $x, 10, $sz * $scale, $sz * $scale)
  $x += $sz * $scale + 20
}
$strip.Save(($PreviewPng -replace '256', 'small'), [System.Drawing.Imaging.ImageFormat]::Png)
