$ErrorActionPreference = 'Stop'
if ([System.Runtime.InteropServices.RuntimeInformation]::OSArchitecture -ne 'X64') {
  throw 'This setup downloads the Windows x64 build. Set WHISPER_CLI and WHISPER_MODEL to your own binary and model.'
}

$runtime = Join-Path $PSScriptRoot '.voice-runtime'
New-Item -ItemType Directory -Path $runtime -Force | Out-Null

function Get-VerifiedFile($Url, $Path, $ExpectedHash) {
  if ((Test-Path -LiteralPath $Path) -and (Get-FileHash -LiteralPath $Path).Hash -eq $ExpectedHash) {
    return
  }
  curl.exe -fLsS -o $Path $Url
  if ($LASTEXITCODE -ne 0 -or (Get-FileHash -LiteralPath $Path).Hash -ne $ExpectedHash) {
    throw "Download or checksum failed: $Url"
  }
}

$cli = Join-Path $runtime 'Release/whisper-cli.exe'
if (!(Test-Path -LiteralPath $cli)) {
  $archive = Join-Path $runtime 'whisper-bin-x64.zip'
  Get-VerifiedFile 'https://github.com/ggml-org/whisper.cpp/releases/download/v1.8.3/whisper-bin-x64.zip' $archive 'D824B1E37599F882B396E73F1EE0BFD5D0529F700314C48311DCBD00B803321D'
  Expand-Archive -LiteralPath $archive -DestinationPath $runtime -Force
}

$model = Join-Path $runtime 'ggml-base-q5_1.bin'
Get-VerifiedFile 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base-q5_1.bin' $model '422F1AE452ADE6F30A004D7E5C6A43195E4433BC370BF23FAC9CC591F01A8898'
Write-Output 'Whisper runtime is ready.'
