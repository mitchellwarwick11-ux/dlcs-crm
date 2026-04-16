# DLCS CRM Project Overview

## Purpose

DLCS CRM is an internal operations platform for Delfs Lascelles Consulting Surveyors. It is designed to bring client management, job tracking, quoting, invoicing, timesheets, reporting, and document generation into one system.

The application appears to be replacing a mix of manual administration, legacy exports, and disconnected tools with a single workflow centered on projects/jobs.

## Product Summary

The project is a custom business application rather than a generic CRM. Its main goal is to support the operational lifecycle of surveying and consulting work:

1. Maintain client records.
2. Create and manage jobs/projects.
3. Define and track project tasks.
4. Record staff time against jobs and tasks.
5. Prepare quotes and fee proposals.
6. Generate invoices from quoted work and billable time.
7. Produce PDFs and store project documents.
8. Report on WIP and operational status.

## Main Modules

### Projects

Projects are the central record in the system. They include:

- Job number, year, and sequence
- Job type and status
- Client link
- Site and title information
- Purchase order data
- Billable/non-billable flag

Projects appear to be the anchor for tasks, time entries, documents, quotes, and invoices.

### Clients

Clients store contact and address information and can be linked to multiple projects and quotes.

### Staff

Staff profiles are tied to Supabase Auth users. Profiles include:

- Name
- Email
- Role
- Default hourly rate
- Active/inactive state

The current app also uses staff profiles for matching login identities, assigning work, and reporting.

### Tasks

Project tasks support operational delivery and billing workflows. The schema indicates tasks can carry:

- Title and description
- Status
- Sort order
- Fee type (`fixed` or `hourly`)
- Quoted amount
- Claimed amount

This suggests tasks are used not only for delivery tracking, but also as invoice/claim building blocks.

### Timesheets

Timesheets allow users to log hours against projects and optionally against tasks. Entries include:

- Date
- Hours
- Notes/description
- Billable flag
- Rate at time of entry
- Link to invoice item once billed

The app currently uses login email to associate the authenticated user with a staff profile.

### Quotes and Fee Proposals

Quotes have been redesigned into a more flexible standalone entity. Based on the migrations and pages, quotes can now:

- Exist before a project is created
- Link to a client
- Store contact/site/job metadata directly
- Use a dedicated quote number sequence
- Use fee proposal templates and selectable scope/note items

This appears to support a workflow where proposals are prepared first and turned into project work later.

### Invoices

Invoices can be created per project and can include:

- Fixed-fee claims by task
- Hourly time-based billing
- Previous claimed amounts
- Quote and client/contact context

Invoice PDFs are generated server-side with React PDF and uploaded to Supabase Storage. Generated files are then registered in the `documents` table.

### Reports

The current reporting area includes a WIP report based on uninvoiced time entries, grouped by job manager/project. This points to the app being used for operational and financial oversight, not just record-keeping.

### Settings and Data Operations

Settings currently cover:

- Company details for documents
- Role rates
- CSV import flows
- Backup and restore
- Demo data cleanup
- Full operational data wipe

This is a strong sign the app is expected to be used as a real internal system, not just a prototype.

## Technology Stack

- Next.js App Router
- React
- TypeScript
- Tailwind CSS 4
- Supabase Auth
- Supabase Postgres
- Supabase Storage
- React Hook Form
- Zod
- React PDF

The UI is built primarily with server-rendered pages and direct Supabase access, with client components used where forms and interactivity are needed.

## Database Overview

The key database entities currently visible are:

- `staff_profiles`
- `clients`
- `projects`
- `project_contacts`
- `project_tasks`
- `task_assignments`
- `time_entries`
- `quotes`
- `quote_items`
- `invoices`
- `invoice_items`
- `documents`
- `role_rates`
- `fee_proposal_templates`
- `purchase_orders`
- sequence/helper tables for job and quote numbering

The schema has evolved through multiple migrations, indicating active product development and changing business requirements.

## Current Architecture Notes

The application is simple in a good way:

- Pages query Supabase directly
- Business workflows are implemented close to the UI
- Server components handle much of the data loading
- Route handlers are used for document-generation style operations

This keeps development fast, but it also means domain logic is spread across pages, forms, and route handlers rather than centralized into a shared service layer.

## What Looks Solid

The following areas already appear meaningfully implemented:

- Authentication and protected dashboard routing
- Project/job listing and detail flows
- Client management
- Staff management
- Timesheet capture
- Quote and fee proposal workflows
- Invoice generation
- PDF generation and document storage
- Reporting
- CSV imports
- Basic system settings

## What Looks In Progress

The project still shows signs of active build-out:

- The root `README.md` is still the default Next.js template.
- The repository has a large amount of uncommitted work in progress.
- Handwritten TypeScript database types may drift from migrations over time.
- Some UI text contains encoding artifacts such as `â€”`, `â€¦`, and `â€“`.
- Permissions and row-level security appear broad and may need tightening later.
- Business logic is distributed across the app and may become harder to maintain as workflows grow.

## Likely Business Goal

The app appears to be evolving into a lightweight vertical ERP/practice-management tool for a surveying consultancy, combining:

- CRM
- job administration
- quoting
- staff time capture
- WIP visibility
- invoicing
- document output
- import/migration tooling

## Recommended Near-Term Priorities

1. Replace the starter `README.md` with project-specific setup and usage documentation.
2. Validate that the live schema, migrations, and `src/types/database.ts` are fully aligned.
3. Clean up text encoding issues in the UI.
4. Document the core business workflows from quote to project to invoice.
5. Gradually move critical domain logic into reusable modules/services as the app grows.

## Useful Starting Files

- `src/components/layout/sidebar.tsx`
- `src/app/(dashboard)/projects/page.tsx`
- `src/app/(dashboard)/quotes/page.tsx`
- `src/app/(dashboard)/timesheets/page.tsx`
- `src/app/(dashboard)/reports/page.tsx`
- `src/app/(dashboard)/settings/page.tsx`
- `src/app/api/invoices/[invoiceId]/pdf/route.ts`
- `src/types/database.ts`
- `supabase/migrations/`

## Working Assumptions

This overview is based on the current repository structure, application pages, and visible migrations as of 13 April 2026 (Australia/Sydney). It should be treated as a living document and updated as workflows and schema continue to evolve.
