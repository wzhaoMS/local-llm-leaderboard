param(
  [string]$Out = '',                 # PNG path (default: .shots\page.png, or .shots\<Only>.png)
  [string]$Only = '',                # render just one section (index.html?only=<section id>)
  [int]$Width = 1440,                # below 512 the page renders in an iframe of this width (phone layouts)
  [int]$Height = 0,                  # default: 1400 for one section, 9000 for the whole page
  [string]$Url = ''                  # screenshot another URL instead (e.g. https://llmleaderboard.com/)
)
# Headless Chrome screenshot of the site (or any URL). Uses its own throw-away profile, so it never touches the
# Chrome windows already open on this PC.   Examples:
#   powershell -NoProfile -ExecutionPolicy Bypass -File tools\shot.ps1 -Only heatmap
#   powershell -NoProfile -ExecutionPolicy Bypass -File tools\shot.ps1 -Out .shots\full.png
$root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$chrome = @('C:\Program Files\Google\Chrome\Application\chrome.exe', 'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe',
  'C:\Program Files\Microsoft\Edge\Application\msedge.exe') | Where-Object { Test-Path $_ } | Select-Object -First 1
if (-not $chrome) { throw 'Chrome/Edge not found' }
if (-not $Url) {
  $Url = 'file:///' + ($root -replace '\\', '/') + '/index.html'
  if ($Only) { $Url += "?only=$Only" }
}
if (-not $Height) { $Height = if ($Only) { 1400 } else { 9000 } }
if (-not $Out) { $Out = Join-Path $root ('.shots\' + $(if ($Only) { $Only } else { 'page' }) + '.png') }
if (-not [IO.Path]::IsPathRooted($Out)) { $Out = Join-Path (Get-Location).Path $Out }
New-Item -ItemType Directory -Force (Split-Path $Out) | Out-Null
Remove-Item $Out -ErrorAction SilentlyContinue
$profileDir = Join-Path $env:TEMP ("lb-shot-" + [guid]::NewGuid().ToString('N').Substring(0, 8))
# Headless Chrome won't make a window narrower than ~512 px, so phone widths render the page inside an iframe of the
# requested width (media queries follow the iframe's viewport) and the PNG is cropped to it afterwards.
$frame = $null
$winW = $Width
if ($Width -lt 512) {
  $frame = Join-Path $env:TEMP ("lb-frame-" + [guid]::NewGuid().ToString('N').Substring(0, 8) + '.html')
  $html = '<!doctype html><html><body style="margin:0"><iframe src="' + $Url + '" style="border:0;width:' + $Width + 'px;height:' + $Height + 'px;display:block"></iframe></body></html>'
  [IO.File]::WriteAllText($frame, $html)
  $Url = 'file:///' + ($frame -replace '\\', '/')
  $winW = 512
}
$args2 = @('--headless=new', '--disable-gpu', '--hide-scrollbars', '--no-first-run', '--no-default-browser-check', '--disable-extensions',
  "--user-data-dir=$profileDir", "--window-size=$winW,$Height", '--virtual-time-budget=4000', "--screenshot=$Out", $Url)
# Start-Process -Wait: chrome.exe returns before the screenshot is written when called with the & operator.
Start-Process -FilePath $chrome -ArgumentList $args2 -Wait -NoNewWindow -RedirectStandardError (Join-Path $env:TEMP 'lb-shot-stderr.txt') | Out-Null
Remove-Item $profileDir -Recurse -Force -ErrorAction SilentlyContinue
if ($frame) {
  Remove-Item $frame -ErrorAction SilentlyContinue
  if (Test-Path $Out) {
    Add-Type -AssemblyName System.Drawing
    $img = [Drawing.Image]::FromFile($Out)
    $crop = ([Drawing.Bitmap]$img).Clone([Drawing.Rectangle]::new(0, 0, [Math]::Min($Width, $img.Width), $img.Height), $img.PixelFormat)
    $img.Dispose()
    $crop.Save($Out, [Drawing.Imaging.ImageFormat]::Png)
    $crop.Dispose()
  }
}
if (Test-Path $Out) { "screenshot: $Out" } else { "screenshot FAILED: $Out" }
