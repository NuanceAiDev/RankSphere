# Supabase Storage Configuration

## Analytics Screenshots Bucket

This project uses Supabase Storage to manage analytics screenshots with automatic organization and cleanup.

### Setup Instructions

1. **Create Bucket**
   - Go to your Supabase Dashboard → Storage
   - Create a new bucket named: `analytics_screenshots`
   - Make it **public** for PDF generation access

2. **Configure Lifecycle Rules**
   - Navigate to Storage → analytics_screenshots → Lifecycle Rules
   - Click "Add Lifecycle Rule"
   - Configure as follows:
     - **Name**: Auto-delete screenshots after 7 days
     - **Condition**: Age greater than 7 days
     - **Action**: Delete object
     - **Scope**: All files in bucket

3. **Folder Structure**
   Files are automatically organized as:
   ```
   analytics_screenshots/
   ├── client-name-slug/
   │   ├── 2025-01/
   │   │   ├── 1730903800_ga4-screenshot.png
   │   │   └── 1730903900_gbp-insights.jpg
   │   └── 2025-02/
   │       └── 1733495800_analytics-overview.png
   └── another-client/
       └── 2025-01/
           └── 1730904000_performance-data.png
   ```

### Features

- **Auto-Organization**: Files sorted by client slug and month (YYYY-MM)
- **Temporary Storage**: 7-day automatic cleanup via lifecycle rules
- **Public Access**: Images accessible for PDF report generation
- **Multi-Format Support**: JPEG, PNG, WebP up to 10MB each
- **Folder Auto-Creation**: Directories created automatically on first upload

### Security Notes

- Files are publicly readable but require knowledge of the exact path
- Automatic deletion prevents long-term storage costs
- Client data is isolated by folder structure
- No sensitive data should be stored in screenshots