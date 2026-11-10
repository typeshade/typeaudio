"""Store explicitly selected authored assets in private R2; never alter bucket visibility."""
import base64
import hashlib
import json
import mimetypes
import os
import sys
from datetime import datetime, timezone
from pathlib import Path
import boto3
from botocore.config import Config
from botocore.exceptions import ClientError

root = Path(sys.argv[1]).resolve()
delivery = root/'delivery'
manifest_bytes = (delivery/'manifest.json').read_bytes()
manifest = json.loads(manifest_bytes)
assert manifest['status']['signalChecked'] and not manifest['status']['selected']
assert json.loads((root/'verification.json').read_text())['outcome'] == 'passed'
bucket = 'typesound'
prefix = 'studies/frieren/v3-sound-design/'+hashlib.sha256(manifest_bytes).hexdigest()[:16]
client = boto3.client('s3', endpoint_url=os.environ['CLOUDFLARE_S3_API_ENDPOINT'],
                      aws_access_key_id=os.environ['CLOUDFLARE_ACCESS_KEY_ID'],
                      aws_secret_access_key=os.environ['CLOUDFLARE_SECRET_ACCESS_KEY'], region_name='auto',
                      config=Config(signature_version='s3v4', request_checksum_calculation='when_required',
                                    response_checksum_validation='when_required'))
names = [v['name']+ext for v in manifest['variants'] for ext in ['.m4a', '.wav']]
names += ['mobile-review.zip', 'aligned-stems.zip', 'source-recipes.zip', 'manifest.json', 'README.txt', 'review-notes.json']
published = []
links = {}
for name in names:
    path = delivery/name
    data = path.read_bytes()
    digest = hashlib.sha256(data).hexdigest()
    key = prefix+'/'+name
    mime = 'audio/mp4' if name.endswith('.m4a') else (mimetypes.guess_type(name)[0] or 'application/octet-stream')
    try:
        existing = client.head_object(Bucket=bucket, Key=key)
    except ClientError as error:
        if error.response['ResponseMetadata']['HTTPStatusCode'] != 404:
            raise
        existing = None
    if existing:
        if existing['Metadata'].get('sha256') != digest:
            raise ValueError('Refuse to replace existing object: '+key)
    else:
        client.put_object(Bucket=bucket, Key=key, Body=data, ContentType=mime,
                          ContentMD5=base64.b64encode(hashlib.md5(data).digest()).decode(), IfNoneMatch='*',
                          Metadata={'sha256': digest, 'source-commit': manifest['sourceCommit']},
                          ContentDisposition=('inline' if name.endswith(('.m4a', '.wav')) else 'attachment')+'; filename="'+name+'"')
    response = client.get_object(Bucket=bucket, Key=key)
    downloaded = hashlib.sha256()
    for chunk in response['Body'].iter_chunks(1024*1024):
        downloaded.update(chunk)
    if downloaded.hexdigest() != digest:
        raise ValueError('Remote object hash mismatch: '+key)
    response['Body'].close()
    published.append(dict(key=key, bytes=len(data), sha256=digest, contentType=mime, remoteHashVerified=True))
    if name.endswith('.m4a') or name == 'mobile-review.zip':
        links[name] = client.generate_presigned_url('get_object', Params={'Bucket': bucket, 'Key': key}, ExpiresIn=604800)
    print('Verified R2 object:', name, len(data), flush=True)
(root/'publication.json').write_text(json.dumps(dict(date=datetime.now(timezone.utc).isoformat(), bucket=bucket,
    prefix=prefix, sourceCommit=manifest['sourceCommit'], access='private; seven-day signed object links only',
    bucketVisibilityChanged=False, sourceVideoUploaded=False, websiteDeployed=False, objects=published), indent=2)+'\n')
(root/'temporary-listening-links.json').write_text(json.dumps(links, indent=2)+'\n')
print('Saved object receipts and temporary listening links separately. Do not commit signed URLs.')
