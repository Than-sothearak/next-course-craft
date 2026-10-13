# Media storage setup

Phase 4 stores uploaded media in a private Amazon S3 bucket. Set `AWS_REGION` and `AWS_S3_BUCKET` in the server environment. The AWS SDK uses `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY` when both are set; on AWS, a scoped instance or task role can provide credentials instead.

Keep S3 Block Public Access enabled. The application only returns an authenticated asset route to the editor; that route redirects the owner to a short-lived signed read URL. Upload policies bind the object key, MIME type, asset ID, and exact file size. Supported uploads are AVIF, GIF, JPEG, PNG, WebP images up to 25 MB and MP4/WebM videos up to 250 MB.

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
