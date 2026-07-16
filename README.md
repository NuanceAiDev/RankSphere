# Nuance Digital - SEO Rank Tracking Dashboard

A modern, comprehensive SEO dashboard application built for agencies to manage multiple clients and track their keyword rankings with monthly snapshots and professional reporting.

## Features

- **Client Management**: Add, edit, and delete clients with domain and industry information
- **Keyword Tracking**: Add keywords manually or via CSV upload with monthly ranking snapshots
- **Rankings Monitoring**: Track keyword ranking changes month-over-month with visual indicators
- **Analytics Screenshots**: Upload and manage analytics screenshots (GA4, GBP, etc.) with automatic organization
- **Professional Reports**: Generate and download PDF reports for clients with ranking comparisons
- **Dark/Light Mode**: Toggle between themes for better user experience
- **Responsive Design**: Works seamlessly on desktop and mobile devices

## Getting Started

### Prerequisites

1. **Supabase Account**: Click "Connect to Supabase" in the top right to set up your database
2. **ValueSERP API Key**: Sign up at [ValueSERP](https://www.valueserp.com/) to get your API key
3. **Supabase Storage**: Ensure the `analytics_screenshots` bucket is created in your Supabase project

### Environment Setup

1. Copy `.env.example` to `.env`
2. Fill in your Supabase credentials (available after connecting to Supabase)
3. Add your ValueSERP API key:
   - Sign up at [ValueSERP](https://www.valueserp.com/) to get your API key
   - Add `VITE_VALUESERP_API_KEY=your_api_key_here` to your `.env` file
   - **Important**: Keep your API key secure and never commit it to version control

### Database Schema

The following tables will be created automatically when you connect to Supabase:

- `clients` - Store client information (name, domain, industry)
- `keywords` - Store keywords with monthly ranking snapshots

### Storage Setup

The application uses Supabase Storage for analytics screenshots:

1. **Bucket Creation**: Create a bucket named `analytics_screenshots` in your Supabase project
2. **Public Access**: Make the bucket publicly readable for PDF generation
3. **Lifecycle Rules**: Set up automatic deletion after 7 days:
   - Go to Supabase → Storage → analytics_screenshots → Lifecycle Rules
   - Name: "Auto-delete screenshots after 7 days"
   - Condition: Age greater than 7 days
   - Action: Delete object
   - Scope: All files in bucket

### Usage

1. **Add Clients**: Click "Add Client" in the sidebar to add new clients with domain and industry
2. **Manage Keywords**: 
   - Add keywords manually one by one
   - Upload multiple keywords via CSV file
   - Delete keywords individually
3. **Upload Analytics**: Use the Analytics tab to upload screenshots (GA4, GBP, etc.) for the current month
4. **Fetch Rankings**: Use the "Fetch Ranks" button to get real-time ranking data from ValueSERP API
5. **View Performance**: Check the Report tab to see month-over-month changes and trends
6. **Generate Reports**: Use the "Generate Report" button to create professional PDF reports with analytics screenshots

## Keyword Management Workflow

### Adding Keywords
- **Manual**: Add individual keywords through the form
- **CSV Upload**: Upload a CSV file with one keyword per line
- **No Immediate API Calls**: Keywords are saved to database without fetching ranks

### Fetching Rankings
- **Monthly Snapshots**: Click "Fetch Ranks" to update all keywords for a client
- **Data Movement**: Current month rank becomes previous month rank
- **API Optimization**: One ValueSERP API call per keyword to prevent duplicates
- **Rate Limiting**: 1-second delay between API calls to respect limits

## Analytics Screenshots Workflow

### Uploading Screenshots
- **Multi-File Upload**: Drag-and-drop or select up to 5 images per client/month
- **Auto-Organization**: Files stored in `client-slug/YYYY-MM/` folder structure
- **Supported Formats**: JPEG, PNG, WebP (max 10MB each)
- **Temporary Storage**: Files auto-delete after 7 days via lifecycle rules

### Report Integration
- **Automatic Inclusion**: Uploaded screenshots appear in generated PDF reports
- **Professional Layout**: Images added after keyword rankings with proper formatting
- **Flexible Content**: Section only appears if screenshots exist for the month

## Tech Stack

- **Frontend**: React, TypeScript, Tailwind CSS
- **Database**: Supabase (PostgreSQL)
- **Storage**: Supabase Storage for analytics screenshots
- **API**: ValueSERP for keyword ranking data
- **Charts**: Recharts for data visualization
- **PDF Generation**: jsPDF for professional reports

## API Integration

The application integrates with ValueSERP API to fetch real-time ranking data:
- **Organic Search Results**: Fetches top 100 results to find domain rankings
- **Monthly Snapshots**: Stores previous and current month rankings with dates
- **Error Handling**: Graceful fallback with detailed error reporting
- **Rate Limiting**: Built-in delays to respect API limits

### Secure API Configuration

To add your ValueSERP API key securely:

1. **Environment Variables**: Add `VITE_VALUESERP_API_KEY` to your `.env` file
2. **Never Hardcode**: API keys are never stored in the UI or committed to code
3. **Fallback Handling**: Application works with mock data when API key is missing

## Report Generation

Professional PDF reports include:
- **Client Information**: Name, domain, industry, and generation date
- **Performance Summary**: Total keywords, improvements, declines, and no-change counts
- **Detailed Table**: Keyword rankings with previous/current month comparison
- **Visual Indicators**: Clear up/down arrows and change calculations
- **Analytics Screenshots**: Uploaded screenshots for the current month (if any)
- **Agency Branding**: Clean, professional layout suitable for client delivery

## Error Handling

- **API Failures**: Graceful handling with user-friendly messages
- **Partial Success**: Reports successful operations even when some fail
- **Data Validation**: Input validation for all forms
- **Rate Limiting**: Automatic delays to prevent API overuse

## Support

For technical issues or feature requests, please refer to the application logs or contact your development team.