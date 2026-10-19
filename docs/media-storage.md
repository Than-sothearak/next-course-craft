# Media storage setup

Coursecraft initially uses a private Amazon S3 bucket for compatibility. Super Admin can select Local Server or AWS S3 at **Administration → Platform settings → Media Storage**. Changing the provider affects new uploads, generated illustrations and course copies; existing assets keep their original provider. Every save tests upload, metadata, read and deletion before atomically updating settings with an audit event. A failed test leaves the active provider unchanged.

For S3, set `AWS_REGION` and `AWS_S3_BUCKET` in the server environment. The AWS SDK uses `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY` when both are set; on AWS, a scoped instance or task role can provide credentials instead.

Keep S3 Block Public Access enabled. The application only returns an authenticated asset route to the editor; that route checks current course access and streams the file server-side using a short-lived signed read URL. Upload policies bind the object key, MIME type, asset ID, and exact file size. The shared upload allowlist supports AVIF/GIF/JPEG/PNG/WebP images up to 25 MB, MP4/WebM videos up to 250 MB, MPEG/MP4/Ogg/WAV/WebM audio up to 100 MB, and PDF/plain-text documents up to 25 MB. Completion checks file signatures as well as sizes and S3 metadata. SVG, HTML, JavaScript, executable formats, Office macro documents and arbitrary ZIP files are not upload types. Documents are served as attachments with nosniff; filenames are never executable paths. Existing image/video editor controls continue to use the same media-library lifecycle; the reusable library also accepts audio and document kinds without introducing new content block types.

Configure CORS in the S3 bucket's **Permissions → Cross-origin resource sharing (CORS)** settings. Include the editor's exact development and production origins. For this local app that is `http://localhost:3000`; replace the example production origin before applying the rule:

```json
[
  {
    "AllowedHeaders": ["*"],
    "AllowedMethods": ["GET", "HEAD", "POST"],
    "AllowedOrigins": ["http://localhost:3000", "https://your-coursecraft-domain.example"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3000
  }
]
```

The app's IAM identity needs `s3:PutObject`, `s3:GetObject`, and `s3:DeleteObject` for objects in this bucket. Do not grant public access or `s3:ListBucket`; the course media library reads asset metadata from MongoDB.


## Local Server deployment

Set the server-only variable `MEDIA_LOCAL_DIRECTORY=/data/coursecraft/uploads` as the default folder before testing Local Server. Selecting Local Server opens a folder chooser; you can also use **Choose folder…** to change the selection. The chooser browses folders on the machine running Coursecraft, not the browser visitor’s computer. On your Mac, use `MEDIA_LOCAL_DIRECTORY=/Users/itcstudio/Desktop/coursecraft/uploads` and `MEDIA_LOCAL_ROOT=/Users/itcstudio/Desktop`. On a hosted deployment, choose a persistent server folder. The path must be absolute and outside the Next.js application directory. Do not use `public`, `.next`, a release directory, a container writable layer or `/tmp` as production media storage. The application creates missing directories with private permissions, but this does **not** provision a persistent volume: provision and mount that volume before starting Coursecraft. Read-only/serverless hosts need S3 or a supported persistent filesystem.

Run Next.js under a dedicated unprivileged OS account. Give that account read/write/traverse access to the mount and prevent other OS accounts from modifying the media directory or its parents. The local adapter rejects traversal keys, symlinked key directories/files, and hardlinked files on reads. Files have generated owner/course/ObjectId keys with no user-supplied extension and are never exposed through a static web-server alias. Private media routes recheck session, approval, permissions and course ownership on every request, including video/audio range requests. Keep all traffic behind TLS.

For a container deployment, mount a host directory or named volume at the same absolute path, for example `-v coursecraft-media:/data/coursecraft/uploads` and set `MEDIA_LOCAL_DIRECTORY` accordingly. For multiple replicas, every instance must share the **same** filesystem at this path; independent per-pod volumes will produce missing media. The filesystem must support atomic same-directory hard links. Coordinate mounts, OS account IDs and storage capacity with the hosting platform. Verify a sample upload after a process restart and a deployment before enabling production traffic.

The local upload endpoint streams raw PUT bodies and enforces the pending file's MIME type and exact byte count, even without a Content-Length header. It also checks origin and authorization directly and bypasses Next Proxy request-body buffering. Set your reverse proxy's upload/body limit above 250 MiB and allow at least five minutes for large uploads. With nginx, configure the upload location with `client_max_body_size 260m` and `proxy_request_buffering off`; configure suitable body/read/send timeouts for your network. Existing S3 browser uploads still need bucket CORS; the server-side Test Connection cannot test browser CORS.

Super Admin can select a different local folder in the UI. Save tests that folder and atomically stores its absolute path in the singleton; new uploads, generated images and course copies retain an immutable `storageDirectory` in their asset records. Existing local assets without this field always use the original `MEDIA_LOCAL_DIRECTORY`, independently of the selected folder. Keep this environment fallback stable while those older assets remain. Reads, deletion and exports use each asset's saved directory. Selecting a folder never moves or deletes existing files. Back up and mount **all** directories that still contain media, not just the currently selected folder.

`MEDIA_LOCAL_ROOT` limits the folder chooser to one approved parent directory; it defaults to the parent of `MEDIA_LOCAL_DIRECTORY`. It must already exist and cannot be the filesystem root. The authenticated folder API requires Super Admin, lists visible directories only, rejects files, symlinks, hidden folders and paths outside the allowed area, and bounds directory enumeration. The browser cannot create folders or choose arbitrary client-machine paths through this API. To add a folder, create it on the server or in Finder, then reopen the chooser. Changing the browse boundary does not invalidate historical asset locations.

S3 bucket and region remain read-only deployment configuration. To relocate infrastructure, copy and verify the relevant datasets, preserve keys, and coordinate environment changes across all instances. Keep S3 credentials/IAM access available after switching to Local Server while S3 assets remain, and retain the local mount after switching back to S3 while local assets remain. Legacy records without a provider or storage key resolve to S3 and their original objectKey; no bulk migration or default-to-local backfill is needed.

## Backups and recovery

Back up MongoDB **and** every persistent media folder/volume as a coordinated dataset, retaining all owner/course/key paths. Back up S3 with versioning/retention appropriate to your recovery requirements. Store encrypted backups separately from the running host and regularly restore them into an isolated environment to verify course previews and HTML/SCORM exports. A MongoDB-only backup cannot restore local files, and a filesystem-only backup cannot recover ownership or per-asset provider metadata. Monitor disk space, inode capacity, mount availability, backup age and failed storage operations. The connection test verifies current read/write/delete access; it does not prove volume persistence or backup health.

Aborted local uploads remove their temporary files. A process kill can leave `pending-*` files; remove only those older than 24 hours during maintenance, outside active uploads. Pending database records and objects can also remain when a browser never completes an upload or a network/storage/database failure interrupts cleanup. During maintenance, reconcile pending assets older than 24 hours against their **recorded** provider/key, delete the object first, then its pending database record only after successful deletion. Never apply a TTL index that deletes asset records without removing their objects. Never sweep ready media simply because it is not currently referenced by a lesson. Keep original-provider metadata for any failed cleanup so it can be retried.

Connection tests use random keys under `storage-probes/`. Include that prefix in the application's object read/write/delete IAM scope. A lost response or denied deletion may leave a probe object; an optional one-day S3 lifecycle expiration restricted to `storage-probes/` removes these safely. Do not apply that lifecycle to course media.

Administration uses the application's existing MongoDB replica-set transactions (including a single-node replica set); see `docs/admin-operations.md`. A transaction or audit failure rolls back the settings change. The active provider is read for every new upload without a persistent cache; pending uploads complete against their saved provider even when settings change in between.

HTML export continues to deliver a self-contained HTML file with data URLs. SCORM 1.2 and 2004 ZIPs include media bytes under relative `media/` paths; PDF handouts load supported images from either provider. No exported learner requires Coursecraft API URLs or credentials. Existing SCORM tracking/reporting behavior is unchanged.

Implementation references: [Node filesystem APIs](https://nodejs.org/api/fs.html) and [AWS presigned URL behavior](https://docs.aws.amazon.com/AmazonS3/latest/userguide/using-presigned-url.html).
