"""Safe raw-file inspection and contact sheets only. Runtime import is a separate reviewed step."""
from pathlib import Path, PurePosixPath
from PIL import Image, ImageDraw
import zipfile, json, hashlib, stat
root = Path('assets/source/acquired')
records = []
for archive in ['clouds.zip', 'foliage.zip']:
    target = root / archive.removesuffix('.zip')
    target.mkdir(exist_ok=True)
    with zipfile.ZipFile(root / archive) as z:
        total = 0
        for info in z.infolist():
            p = PurePosixPath(info.filename)
            total += info.file_size
            if p.is_absolute() or '..' in p.parts or ':' in info.filename or stat.S_ISLNK(info.external_attr >> 16) or total > 150_000_000:
                raise ValueError('Unsafe archive member')
            dest = (target / Path(*p.parts)).resolve()
            if not dest.is_relative_to(target.resolve()): raise ValueError('Outside isolated archive directory')
            if info.is_dir(): dest.mkdir(parents=True, exist_ok=True)
            else:
                dest.parent.mkdir(parents=True, exist_ok=True)
                dest.write_bytes(z.read(info))
    images = []
    for p in sorted(target.rglob('*.png')):
        image = Image.open(p).convert('RGBA')
        records.append({'path': p.as_posix(), 'size': image.size, 'alphaExtrema': image.getchannel('A').getextrema(), 'sha256': hashlib.sha256(p.read_bytes()).hexdigest()})
        images.append((p.name, image))
    if archive == 'clouds.zip':
        sheet = Image.new('RGB', (1200, len(images)*180))
        for i, (name, image) in enumerate(images):
            for j, bg in enumerate([(115,173,210),(237,172,124),(17,32,64)]):
                cell = Image.new('RGBA', (400,180), bg+(255,)); thumb=image.copy(); thumb.thumbnail((330,150)); cell.alpha_composite(thumb, ((400-thumb.width)//2,20)); ImageDraw.Draw(cell).text((8,5),name,fill='white'); sheet.paste(cell.convert('RGB'),(j*400,i*180))
    else:
        sheet = Image.new('RGB',(1000,((len(images)+7)//8)*130),(109,153,166))
        for i,(name,image) in enumerate(images):
            image.thumbnail((112,96)); sheet.paste(image,(i%8*125,(i//8)*130+20),image); ImageDraw.Draw(sheet).text((i%8*125+3,(i//8)*130+4),name,fill='white')
    sheet.save(root / (archive.removesuffix('.zip')+'-review.jpg'))
wood=Image.open(root/'wood_table_diffuse.jpg'); records.append({'path':(root/'wood_table_diffuse.jpg').as_posix(),'size':wood.size,'sha256':hashlib.sha256((root/'wood_table_diffuse.jpg').read_bytes()).hexdigest()})
(root/'raw-inspection.json').write_text(json.dumps(records,indent=2))
print('Inspected',len(records),'raw files; created review sheets. No runtime imports yet.')
