"""Import only raw assets visually reviewed on 2026-10-14; reproducible derivatives."""
from PIL import Image, ImageEnhance
from pathlib import Path
import hashlib,json,shutil
root=Path('assets/source/acquired'); dest=Path('assets/runtime'); dest.mkdir(exist_ok=True)
metadata_file=root/'acquisition.json'
if not metadata_file.exists(): metadata_file=Path('assets/source/acquisition.json')
acquired={r['id']:r for r in json.loads(metadata_file.read_text())}
manifest={'schemaVersion':1,'assets':[],'originalArtwork':{'source':'src/renderer/scene.ts','additionalSource':'src/renderer/regional-landscapes.ts','license':'MIT','copyright':'Copyright (c) 2026 Alin-Alexandru Ion','status':'Original illustrative sky, terrain shapes, regional landscapes, near-branch skeleton, clouds and lighting; selected Kenney foliage is composed into landscape and branch. Final style still needs owner art-direction review; imported ingredients retain CC0 provenance.'}}
def register(id,original,output,transform,alpha):
    source=acquired[id]; im=Image.open(output)
    member='PNG/Flat/'+original.name if id=='A02' else 'PNG/Default size/'+original.name if id=='A11' else source['downloadUrl'].split('/')[-1]
    manifest['assets'].append({'localPath':output.as_posix(),'sourceAssetId':id,'creator':source['creator'],'sourcePage':source['page'],'acquisitionUrl':source['downloadUrl'],'license':'CC0-1.0','licenseEvidence':source['evidence'],'retrievedAt':source['retrieved'],'archiveSha256':source['sha256'],'selectedMember':member,'sourceLocalPath':f'assets/source/selected/{id}/{original.name}','originalSha256':hashlib.sha256(original.read_bytes()).hexdigest(),'derivativeSha256':hashlib.sha256(output.read_bytes()).hexdigest(),'transformations':transform,'dimensions':im.size,'alphaFormat':alpha,'watermarkReview':'No embedded branding/watermarks observed in selected raw art; preview/sample branding is not imported','reviewer':'Codex visual inspection','reviewedOn':'2026-10-17' if id=='A11' or (id=='A02' and original.stem in ['sprite_0001','sprite_0003','sprite_0005','sprite_0041','sprite_0044']) else '2026-10-14','classification':'runtime','artDirection':'Ingredient approved for illustrative scene; integrated final artwork remains provisional'})
for i in [30,31,32,35,38]:
    original=Path(f'assets/source/selected/A02/sprite_{i:04}.png'); im=Image.open(original).convert('RGBA'); bounds=im.getchannel('A').getbbox(); im=im.crop(bounds); im.thumbnail((256,256),Image.Resampling.LANCZOS); output=dest/f'leaf-{i}.png'; im.save(output); register('A02',original,output,'Crop to alpha bounds; fit within 256x256 with Lanczos; retain RGBA soft alpha','RGBA')
for kind, indices in [('grass',[1,3,5]),('sprig',[41,44])]:
    for i in indices:
        original=Path(f'assets/source/selected/A02/sprite_{i:04}.png'); im=Image.open(original).convert('RGBA'); bounds=im.getchannel('A').getbbox(); im=im.crop(bounds); im.thumbnail((256,256),Image.Resampling.LANCZOS); output=dest/f'{kind}-{i}.png'; im.save(output); register('A02',original,output,'Crop to alpha bounds; fit within 256x256 with Lanczos; retain soft RGBA alpha','RGBA')
for i in [4,6,7,9,11]:
    original=Path(f'assets/source/selected/A11/foliagePack_{i:03}.png'); output=dest/f'forest-tree-{i}.png'; shutil.copyfile(original,output); register('A11',original,output,'Selected clean transparent PNG copied unchanged; varied by scale, position, flip, and daylight tint in cached terrain','RGBA')
original=Path('assets/source/selected/A06/wood_table_diffuse.jpg'); im=Image.open(original).convert('RGB'); im=ImageEnhance.Color(im).enhance(.72); im=ImageEnhance.Brightness(im).enhance(1.18); output=dest/'wood.jpg'; im.save(output,quality=90); register('A06',original,output,'Saturation 0.72; brightness 1.18; JPEG quality 90; original size retained','opaque RGB')
Path('assets/asset-manifest.json').write_text(json.dumps(manifest,indent=2))
license_file=next((root/'foliage').rglob('*License*'),None)
if license_file: shutil.copyfile(license_file,'assets/licenses/Kenney-CC0.txt')
shutil.copyfile(root/'foliage-pack'/'License.txt','assets/licenses/Kenney-Foliage-Pack-CC0.txt')
catalog_source=Path('../RainByePass_Handover/assets/asset-catalog.json')
if not catalog_source.exists(): catalog_source=Path('assets/asset-catalog.json')
source_catalog=json.loads(catalog_source.read_text(encoding='utf-8-sig'))
source_catalog['status']='selected_candidates_acquired_reviewed_and_imported'
source_catalog['assets']=[item for item in source_catalog['assets'] if item['id']!='A11']
source_catalog['assets'].append({'id':'A11','title':'Foliage Pack','creatorAsRecorded':'Kenney Vleugels / Kenney','sourcePage':'https://kenney.nl/assets/foliage-pack','licenseEvidence':'https://kenney.nl/assets/foliage-pack','declaredLicense':'CC0-1.0','role':'distant_forest_tree_ingredients','priority':'selected_candidate','pageCheckedOn':'2026-10-17','downloaded':True,'imported':True,'actualDownloadUrl':acquired['A11']['downloadUrl'],'archiveSha256':acquired['A11']['sha256'],'localFiles':[r['localPath'] for r in manifest['assets'] if r['sourceAssetId']=='A11'],'rawWatermarkCheck':'Selected raw PNGs visually inspected with transparency; no embedded branding or watermarks. Watermarked promotional preview not imported.','alphaAndDimensionsCheck':'Selected raw PNGs inspected; exact dimensions in asset-manifest.json','artDirectionApproval':'Initial forest/tree ingredients only; final composition provisional','notes':'Five transparent green tree shapes selected from Default size; cached varied forest line, no raw preview or logo shipped.'})
for item in source_catalog['assets']:
    if item['id']=='A11': continue
    if item['id'] in acquired:
        a=acquired[item['id']]; item.update({'downloaded':True,'actualDownloadUrl':a['downloadUrl'],'archiveSha256':a['sha256'],'rawWatermarkCheck':'selected raw files visually inspected, no embedded marks observed','alphaAndDimensionsCheck':'assets/source/acquired/raw-inspection.json','imported':item['id'] in ['A02','A06'],'artDirectionApproval':'initial ingredients only' if item['id']!='A01' else 'rejected: smoky/dark and diffuse; original fair-weather clouds used'})
        item['localFiles']=[r['localPath'] for r in manifest['assets'] if r['sourceAssetId']==item['id']]
        item['alphaAndDimensionsCheck']='assets/source/acquired/raw-inspection.json'
        item['notes']={'A01':'Acquired and visually inspected on blue/orange/night backgrounds; rejected for smoky/dark/diffuse appearance. No runtime import.','A02':'Ten inspected flat masks imported: five leaves, three grass clumps and two sprigs. Selected originals retained.','A06':'Actual 1k diffuse texture inspected and graded for the original segmented frame.'}[item['id']]
Path('assets/asset-catalog.json').write_text(json.dumps(source_catalog,indent=2))
print('Imported 10 reviewed Kenney foliage masks, 5 reviewed tree sprites and 1 reviewed wood derivative; A01 not shipped.')
