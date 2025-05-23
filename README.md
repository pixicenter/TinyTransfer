# TinyTransfer - Secure File Transfer Application

A secure file transfer application built with Next.js, allowing users to upload files and share them via links and email.

## Features


- Password protection for transfers
- Automatic file archiving
- Configurable file expiration
- Email notifications with customizable templates
- Admin dashboard with transfer statistics
- Background slideshow customization
- Multi-language support (English and Romanian)
- Responsive design for all devices
- Dark/Light theme options

## Application Architecture

TinyTransfer uses:

- **Next.js**: Frontend and API routes
- **SQLite**: Database (using better-sqlite3)
- **Tailwind CSS**: Styling
- **TypeScript**: Type-safe code
- **Node.js**: Runtime environment
- **Nodemailer**: Email functionality
- **JWT**: Authentication tokens
- **bcrypt**: Password hashing


### Custom Development


TinyTransfer supports custom configurations and development to meet specific requirements:

- **Email Integration**: Custom email templates and delivery configurations
- **Storage Backends**: Integration with various storage solutions beyond the default
- **Authentication Systems**: Custom authentication flows and user management
- **UI Customization**: Branded interfaces and custom themes
- **API Extensions**: Additional endpoints for integration with other systems

Custom development services are available on demand. For specific requirements or modifications not covered by the standard configuration options, please reach out through the repository issues or contact information.
## Prerequisites

- Node.js 18 or later
- npm or yarn
- (Optional) SMTP server or SendMail configuration for email notifications

## Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd TinyTransfer
```

2. Install dependencies:
```bash
npm install
```

3. Create configuration files (see Environment Variables section below)

4. Start the development server:
```bash
npm run dev
```

5. Open [http://localhost:3000](http://localhost:3000) in your browser.

## Production Deployment

For production deployment:

```bash
npm run build
npm start
```

For optimal performance, consider using a process manager like PM2:

```bash
npm install -g pm2
pm2 start npm --name "TinyTransfer" -- start
pm2 save
pm2 startup
```

## Environment Variables


Create a `.env.local` file in the root directory with the following:

```
# Application Configuration
APP_NAME=TinyTransfer
HOSTNAME=yourdomain.com

# Email Configuration
# Option 1: Using SendMail (recommended for VPS)
USE_SENDMAIL=true
DOMAIN=yourdomain.com


# OR Option 2: Direct SMTP configuration
USE_SENDMAIL=false
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=user@example.com
SMTP_PASSWORD=password

# Custom "From" address (optional)
EMAIL_FROM=noreply@yourdomain.com

# Optional: Custom sendmail path (if not using default)
# SENDMAIL_PATH=/usr/bin/msmtp
```

### `.env` (can be committed to repository)

```
# Public settings that can be committed to the repository
NODE_ENV=development
# or production in production environment
```

## First-time Setup

1. When you first access the application, you'll be redirected to the setup page.
2. Create an admin password (minimum 8 characters).
3. After setup, you can log in with your admin password.
4. Configure the application settings from the admin dashboard:
   - Application name and logo
   - Theme and language preferences
   - Email settings
   - Slideshow configuration

## Usage

### Uploading Files

1. Log in to the admin dashboard
2. Drag and drop files or click to select them
3. Optionally add a transfer name (otherwise, first filename will be used)
4. Optionally set a password for the transfer
5. Choose an expiration time or set to never expire
6. Optionally enter a recipient email
7. Click "Upload Files"
8. Share the generated download link with others

### Downloading Files

1. Open the download link
2. If you want the transfer to be password-protected, enter the password
3. Click "Download Files"

### Managing Transfers

From the admin dashboard you can:
- View all transfers
- See detailed statistics for each transfer
- Copy download links
- Send download links via email
- Extend expiration period
- Delete transfers

### Customizing Appearance

The application supports:
- Custom name and logo upload
- Background slideshow customization
- Language selection (English/Romanian)

## Security Features

- Password protection for transfers
- Automatic file expiration
- Secure admin authentication
- HTTPS support in production
- Optional storage path configuration
- Secure file handling

## Email Configuration

The application supports multiple methods for sending emails:

### 1. Using SendMail on VPS (Recommended for self-hosted installations)

#### Installation on Ubuntu/Debian:

```bash
sudo apt-get update
sudo apt-get install sendmail
sudo sendmailconfig  # Answer Y to all questions
```

#### Installation on CentOS/RHEL:

```bash
sudo yum install sendmail sendmail-cf
sudo sendmailconfig
```

#### DNS Configuration (Important for deliverability):

1. **A Record**: Ensure your domain has an A record pointing to your VPS IP
2. **PTR Record (Reverse DNS)**: Contact your VPS provider to set up reverse DNS
3. **SPF Record**: Add a TXT record for SPF:
   ```
   v=spf1 a mx ip4:YOUR_SERVER_IP -all
   ```
4. **DKIM Record** (optional but recommended): Configure DKIM for email authentication

#### Testing Your Configuration:

```bash
node src/scripts/test-email.js email@test.com
```

### 2. Alternative Email Methods

#### Using Postfix:
```bash
sudo apt-get install postfix
```

#### Using msmtp:
```bash
sudo apt-get install msmtp
```

When using msmtp, update the path in the `.env.local` configuration:
```
USE_SENDMAIL=true
SENDMAIL_PATH=/usr/bin/msmtp
```

## Troubleshooting Email Issues

### Checking Mail Queues
```bash
sudo mailq
```

### Checking Logs
```bash
sudo tail -f /var/log/mail.log    # For Ubuntu/Debian
sudo tail -f /var/log/maillog     # For CentOS/RHEL
```

### Common Issues:

1. **Emails marked as spam**: 
   - Ensure proper DNS configuration (SPF, DKIM)
   - Check if server IP is blacklisted

2. **Sending errors**:
   - Verify port 25 is not blocked by VPS provider
   - Check server firewall allows traffic on port 25

3. **Permission issues**:
   - Check if the user running Next.js has permission to access the sendmail executable

### Advanced SendMail Configuration

For more advanced and customized sendmail settings, you can edit the configuration file:

```bash
sudo nano /etc/mail/sendmail.mc
```

After editing, rebuild and restart sendmail:

```bash
sudo m4 /etc/mail/sendmail.mc > /etc/mail/sendmail.cf
sudo systemctl restart sendmail
```



### Custom Configurations

To customize the application:
- Modify theme settings in `src/lib/useThemeStyles.tsx`
- Add new languages in `src/lib/translations/`
- Add encryption options in relevant services

## Contributing

Contributions are welcome! Please follow these steps:

1. Fork the repository
2. Create a feature branch: `git checkout -b feature-name`
3. Commit your changes: `git commit -m 'Add some feature'`
4. Push to the branch: `git push origin feature-name`
5. Open a Pull Request

## License

MIT

## Support

For support, issues, or feature requests, please create an issue in the repository. 


//NOTES

The cleanup service has to be more intelligent, eventualy connected with the database so he can start on time to do the job, 
parallel deleting transfers on the exact expiring date and time.

1. Procesul de Upload
Etapa de Inițializare
Selectarea fișierelor:
Utilizatorul selectează fișierele prin drag-and-drop sau butonul de selectare
Sistemul validează mărimea și numărul fișierelor
Inițializarea transferului:
Se trimite un request la /api/upload/initialize cu:
Numele transferului
Numărul de fișiere
Mărimea totală
Opțiuni: parolă, perioadă de expirare, email destinatar
Serverul generează un ID unic pentru transfer
Se creează un director temporar pentru fișiere
Se returnează ID-ul transferului către client
Etapa de Upload
Încărcarea fișierelor în loturi:
Fișierele sunt împărțite în loturi (batches) pentru eficiență
Pentru fiecare lot, se face request la /api/upload/batch
Fișierele sunt procesate în paralel, dar se limitează numărul de cereri simultane
Se afișează progresul încărcării în timp real
Gestionarea pe server:
Serviciul R2StorageService stochează fișierele în storage-ul Cloudflare R2
Fiecare fișier primește un path unic bazat pe ID-ul transferului
Se actualizează contorul de fișiere încărcate
Etapa de Finalizare
Finalizarea transferului:
După încărcarea tuturor fișierelor, se trimite request la /api/upload/finalize
Serverul verifică existența fișierelor
Calculează dimensiunea totală
Setează data de expirare conform opțiunii alese
Hașurează parola (dacă există)
Înregistrarea în baza de date:
Se creează o înregistrare în tabela transfers
Se adaugă fișierele în tabela files
Se inițializează statisticile transferului
Se generează link-ul de descărcare
2. Procesul de Download
Verificarea Transferului
Accesarea link-ului:
Utilizatorul accesează pagina /download/[id]
Sistemul verifică:
Dacă transferul există
Dacă nu a expirat
Dacă are protecție cu parolă
Autentificare (dacă este cazul):
Dacă transferul este protejat cu parolă, se solicită introducerea acesteia
Parola este verificată prin API-ul /api/download/[id] (metoda POST)
După validarea parolei, se permite descărcarea
Descărcarea Arhivei
Inițierea descărcării:
La apăsarea butonului "Descarcă arhiva", se face request la /api/download/[id]
Serverul:
Listează fișierele transferului din R2 Storage
Creează o arhivă ZIP "on-the-fly" (fără a o stoca temporar)
Streamează arhiva direct către browser
Monitorizarea și statistici:
Se înregistrează descărcarea în baza de date
Se actualizează statisticile de acces (access_logs)
Se afișează progresul descărcării în interfața utilizatorului
3. Mecanismul de Expirare și Curățare
Setarea expirării:
La crearea transferului, se stabilește data de expirare
Opțiunile includ: 2 minute (test), 1 lună, 3 luni sau permanent
Procesul automat de curățare:
Serviciul CleanupService verifică transferurile expirate la fiecare 10 minute
Pentru fiecare transfer expirat:
Se șterg fișierele din storage-ul R2
Se șterg înregistrările din baza de date în ordinea corectă (pentru a respecta constrângerile de cheie străină)
Se înregistrează activitatea în fișierul de log
Curățarea manuală prin cron:
Se poate programa un cronjob pe server care apelează scriptul run-cleanup.js
Acest script face un request la /api/cleanup pentru a forța curățarea
Oferă o metodă mai fiabilă decât programarea internă din Node.js
Acest flux de lucru asigură gestionarea eficientă a transferurilor de fișiere, cu accent pe securitate (parole, expirări automate) și experiența utilizatorului (progres în timp real, interfață intuitivă).