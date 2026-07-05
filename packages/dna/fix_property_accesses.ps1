# Script to fix property accesses in core.ts
$file = "e:\Antigravity\ytn\packages\dna\src\builder\core.ts"
$content = Get-Content $file -Raw

# Replace property accesses with extended
$content = $content -replace 'this\._stt\.parts', 'this._stt.extended.parts'
$content = $content -replace 'this\._stt\.schemas', 'this._stt.extended.schemas'
$content = $content -replace 'this\._stt\.combinatorType', 'this._stt.extended.combinatorType'
$content = $content -replace 'this\._stt\.discriminator', 'this._stt.extended.discriminator'
$content = $content -replace 'this\._stt\.keySchema', 'this._stt.extended.keySchema'
$content = $content -replace 'this\._stt\.decodeTwin', 'this._stt.extended.decodeTwin'
$content = $content -replace 'this\._stt\.encodeTwin', 'this._stt.extended.encodeTwin'
$content = $content -replace 'this\._stt\.getter', 'this._stt.extended.getter'
$content = $content -replace 'this\._stt\.property', 'this._stt.extended.property'
$content = $content -replace 'this\._stt\.schema', 'this._stt.extended.schema'

# Write back
Set-Content $file $content -NoNewline

Write-Host "Property accesses updated successfully"
