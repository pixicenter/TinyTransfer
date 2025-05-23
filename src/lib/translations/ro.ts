const ro = {
  common: {
    appName: 'MyTransfer',
    loading: 'Se încarcă...',
    error: 'Eroare',
    success: 'Succes',
    save: 'Salvează',
    cancel: 'Anulează',
    delete: 'Șterge',
    edit: 'Editează',
    view: 'Vizualizează',
    create: 'Creează',
    send: 'Trimite',
    download: 'Descarcă',
    upload: 'Încarcă',
    copy: 'Copiază',
    copied: 'Copiat',
    search: 'Caută',
    filter: 'Filtrează',
    sort: 'Sortează',
    next: 'Înainte',
    previous: 'Înapoi',
    confirm: 'Confirmă',
    processing: 'Se procesează...',
    required: 'Câmp obligatoriu',
    retry: 'Încearcă din nou',
    close: 'Închide',
    or: 'sau',
    default: 'implicit',
    uploading: 'Se încarcă...',
    saveChanges: 'Salvează Modificările',
  },
  auth: {
    login: 'Autentificare',
    logout: 'Deconectare',
    email: 'Email',
    password: 'Parolă',
    confirmPassword: 'Confirmă parola',
    loginButton: 'Autentificare',
    initialSetup: 'Configurare inițială',
    setupAdmin: 'Configurați contul de administrator',
    adminPassword: 'Parolă administrator',
    passwordLength: 'Parola trebuie să conțină minim 8 caractere',
    passwordsMismatch: 'Parolele nu coincid',
    setupButton: 'Configurează',
    setupProcessing: 'Se procesează...',
    checkingConfig: 'Se verifică configurarea...',
    setupSuccessful: 'Cont admin configurat cu succes',
    setupFailed: 'Configurarea a eșuat',
    loginFailed: 'Autentificare eșuată',
    alreadySetup: 'Contul de admin este deja configurat',
    configureAdminAccount: 'Configurați contul de administrator',
    adminLogin: 'Autentificare Administrator',
    enterPasswordPrompt: 'Introduceți parola pentru a accesa zonele protejate',
    loginPrompt: 'Introduceți emailul și parola pentru a accesa zonele protejate',
    enterPassword: 'Introduceți parola',
    passwordMinLength: 'Parola trebuie să conțină minim 8 caractere',
    passwordRequirements: 'Parola nu îndeplinește cerințele de complexitate',
    passwordRequirementsList: 'Cerințe pentru parolă',
    passwordWeak: 'Slabă',
    passwordMedium: 'Medie',
    passwordStrong: 'Puternică',
    minLength: 'Minim 8 caractere',
    upperCase: 'Cel puțin o literă mare (A-Z)',
    lowerCase: 'Cel puțin o literă mică (a-z)',
    digit: 'Cel puțin o cifră (0-9)',
    symbol: 'Cel puțin un simbol (!@#$...)',
    passwordsDoNotMatch: 'Parolele nu coincid',
    configure: 'Configurează',
    unauthorized: 'Acces neautorizat',
    openLoginModal: 'Portal Admin',
    closeModal: 'Închide',
    setupRequiredMessage: 'Configurarea este necesară deoarece baza de date nu este configurată. Vă rugăm să creați un cont de administrator pentru a continua.',
  },
  header: {
    dashboard: 'Panou de control',
    transfers: 'Transferuri',
    settings: 'Setări',
  },
  footer: {
    poweredBy: 'Powered by',
    copyright: 'Toate drepturile rezervate - Cristian Turcu',
    tagline: 'Transfer de fișiere simplu și sigur',
  },
  dashboard: {
    title: 'Panou de control',
    newTransfer: 'Transfer nou',
    recentTransfers: 'Transferuri recente',
    statistics: 'Statistici',
    totalTransfers: 'Total transferuri',
    totalDownloads: 'Total descărcări',
    activeTransfers: 'Transferuri active',
    expiredTransfers: 'Transferuri expirate',
    uploadFiles: 'Încarcă fișiere',
    dragDrop: 'Trage și plasează fișierele aici',
    browse: 'click pentru a le selecta',
    uploadSuccess: 'Fișiere încărcate cu succes',
    uploadLink: 'Link de descărcare',
    emailSent: 'Email trimis',
    used: 'utilizat',
    accountInfo: 'Informații cont',
    totalFiles: 'Total fișiere',
    availableStorage: 'Spațiu disponibil',
    viewAllTransfers: 'Vezi toate transferurile',
  },
  transfers: {
    title: 'Transferurile Mele',
    noTransfers: 'Niciun transfer încă. Creează primul tău transfer!',
    createYourFirstTransfer: 'Creează primul tău transfer pentru a începe să partajezi fișiere.',
    createTransfer: 'Creează un transfer',
    uploading: 'Se încarcă...',
    uploadComplete: 'Încărcare finalizată!',
    uploadError: 'Eroare la încărcare',
    permanent: 'Permanent',
    expired: 'Expirat',
    expiresInDay: 'Expiră într-o zi',
    expiresInDays: 'Expiră în {days} zile',
    copyLink: 'Copiază Link',
    linkCopied: 'Link Copiat!',
    sendEmail: 'Trimite Email',
    enterEmail: 'Introdu email-ul destinatarului',
    sending: 'Se trimite...',
    emailSentSuccess: 'Email trimis cu succes!',
    viewStats: 'Vezi Statistici',
    delete: 'Șterge',
    confirmDelete: 'Ești sigur că vrei să ștergi acest transfer? Această acțiune nu poate fi anulată.',
    deleting: 'Se șterge...',
    files: 'Fișiere',
    totalSize: 'Dimensiune Totală',
    createdAt: 'Creat La',
    expiresAt: 'Expiră La',
    status: 'Status',
    actions: 'Acțiuni',
    archiveNameLabel: 'Nume Arhivă',
    extendExpiration: 'Prelungește Expirarea',
    extendExpirationButton: 'Extinde',
    extendExpirationTitle: 'Prelungește Expirarea Transferului',
    currentExpiration: 'Expirare Curentă',
    expirationOptions: {
      '2-minutes': 'Expiră în 2 minute (test)',
      '1-month': 'Prelungește cu 1 Lună',
      '3-months': 'Prelungește cu 3 Luni',
      permanent: 'Setează ca Permanent (Fără Expirare)'
    },
    linkViews: 'Vizualizări',
    downloads: 'Descărcări',
    uniqueIPs: 'IP-uri Unice (Vizualizări/Descărcări)',
    created: 'Creat',
    expires: 'Expiră',
    confirmDeleteMessage: 'Această acțiune va șterge permanent transferul și toate fișierele asociate. Această acțiune nu poate fi anulată.',
    deleteTransfer: 'Șterge transferul',
    lastAccessed: 'Ultimul Acces',
    emailStatus: 'Email trimis',
    emailError: 'Eroare email',
    noEmail: 'Fără email',
    sendEmailTitle: 'Trimite link-ul prin email',
    sendEmailMessage: 'Introdu adresa de email a destinatarului pentru a trimite link-ul de descărcare.',
    emailAddress: 'Adresa de email',
    emailRecipient: 'Email (opțional)',
    emailPlaceholder: 'Introduceți adresa de email',
    emailInfo: 'Dacă completați, vom trimite link-ul de descărcare automat la această adresă',
    selectFile: 'Selectează fișier',
    uploadButton: 'Încarcă fișierele',
    cancel: 'Șterge fișierele',
    selectedFiles: 'Fișiere selectate:',
    noFilesSelected: 'Niciun fișier selectat',
    fileSizeLimit: 'Limită mărime fișier:',
    passwordProtected: 'Protejat cu parolă'
  },
  upload: {
    title: 'Încarcă fișiere',
    dropzone: 'de pe dispozitiv',
    selectFiles: 'Selectează fișiere',
    uploading: 'Se încarcă...',
    uploadingFiles: 'Se încarcă fișiere...',
    archivingFiles: 'Se arhivează fișiere...',
    completingTransfer: 'Se încarcă...',
    uploadComplete: 'Încărcare finalizată!',
    uploadFailed: 'Încărcare eșuată',
    uploadSuccess: 'Fișiere încărcate cu succes!',
    uploadMoreFiles: 'Încarcă mai multe fișiere',
    shareLink: 'Partajează link-ul',
    transferName: 'Nume transfer',
    transferNamePlaceholder: 'Dacă nu este finalizat, numele primului fișier va fi folosit',
    password: 'Parolă (opțional)',
    passwordPlaceholder: 'Setează o parolă pentru descărcare',
    expiration: 'Expiră în',
    days: 'zile',
    never: 'Niciodată',
    emailRecipient: 'Email (opțional)',
    emailPlaceholder: 'Introduceți adresa de email',
    emailInfo: 'Dacă introduceți un email, vom trimite automat link-ul de descărcare la această adresă',
    selectFile: 'Selectează fișier',
    uploadButton: 'Încarcă fișiere',
    cancel: 'Șterge fișierele',
    selectedFiles: 'Fișiere selectate:',
    noFilesSelected: 'Niciun fișier selectat',
    fileSizeLimit: 'Limită mărime fișier:',
    totalSize: 'Dimensiune Totală:',
    processingFiles: 'Se încarcă...',
    overallProgress: 'Progres transfer:',
  },
  download: {
    title: 'Descarcă fișiere',
    downloadTransfer: 'Descarcă transfer',
    downloadButton: 'Descarcă arhiva',
    passwordProtected: 'Acest transfer este protejat cu parolă',
    enterPassword: 'Introduceți parola:',
    passwordPlaceholder: 'Parolă',
    wrongPassword: 'Parolă incorectă',
    filesInTransfer: 'Fișiere în transfer:',
    downloadComplete: 'Descărcare completă',
    downloadFailed: 'Descărcare eșuată',
    transferExpired: 'Acest transfer a expirat',
    transferNotFound: 'Transfer negăsit',
    totalSize: 'Mărime totală:',
    welcome: 'Transfer de fișiere securizat',
    description: 'Descarcă fișiere în siguranță, rapid și fără înregistrare.',
    securityNote: 'Toate transferurile sunt criptate și protejate.',
  },
  settings: {
    title: 'Setări',
    general: 'Generale',
    appearance: 'Aspect',
    email: 'Email',
    account: 'Cont',
    appName: 'Numele aplicației',
    appNameHelp: 'Acest nume va apărea în header, footer și titlul paginilor.',
    appLogo: 'Logo aplicație',
    appLogoHelp: 'Adresa URL a logo-ului care va apărea în header (lăsați gol pentru a folosi icon-ul implicit).',
    logoType: 'Tipul logo-ului',
    logoTypeFile: 'Fișier',
    logoUrlHelp: 'URL-ul imaginii logo care va fi afișată (format recomandat: PNG sau SVG)',
    selectLogo: 'Selectează logo',
    logoUploadSuccess: 'Logo încărcat cu succes!',
    logoUploadFailed: 'Eroare la încărcarea logo-ului.',
    logoDeleteSuccess: 'Logo șters cu succes!',
    logoDeleteFailed: 'Eroare la ștergerea logo-ului.',
    logoDownloadSuccess: 'Logo descărcat și salvat cu succes!',
    logoDownloadFailed: 'Eroare la descărcarea logo-ului.',
    applyLogo: 'Aplică Logo',
    logoUrlDownloadInfo: 'Logo-ul va fi descărcat și salvat local când apăsați "Aplică Logo" sau "Salvează setările".',
    invalidLogoUrl: 'URL-ul logo-ului nu este valid. Trebuie să înceapă cu http:// sau https://',
    theme: 'Temă',
    themeHelp: 'Tema va afecta aspectul întregii aplicații.',
    themeLight: 'Luminoasă',
    themeDark: 'Întunecată',
    save: 'Salvează setările',
    saveSuccess: 'Setări salvate cu succes',
    saveFailed: 'Salvarea setărilor a eșuat',
    uploadLogo: 'Încarcă logo',
    language: 'Limbă',
    languageHelp: 'Limba în care va fi afișată interfața aplicației.',
    languageRo: 'Română',
    languageEn: 'Engleză',
    
    // Slideshow settings
    slideshowSettings: 'Setări Slideshow',
    slideshowInterval: 'Interval afișare',
    slideshowIntervalHelp: 'Intervalul de timp (în milisecunde) între schimbările de imagine.',
    slideshowEffect: 'Efect de tranziție',
    effectFade: 'Fade (estompare)',
    effectSlide: 'Slide (glisare)',
    effectZoom: 'Zoom',
    slideshowEffectHelp: 'Efectul vizual aplicat la schimbarea imaginilor.',
    
    // Gallery management
    generalSettings: 'Setări generale',
    galleryManagement: 'Administrare Galerie',
    uploadNewImage: 'Încarcă imagine nouă',
    selectImage: 'Selectează imagine',
    supportedFormats: 'Formate suportate: JPG, PNG, WebP, GIF',
    uploadSuccess: 'Imaginea a fost încărcată cu succes!',
    uploadFailed: 'Eroare la încărcarea imaginii.',
    galleryImages: 'Imagini în galerie',
    noImages: 'Nu există imagini în galerie.',
    deleteImage: 'Șterge imaginea',
    deleteSuccess: 'Imaginea a fost ștearsă cu succes!',
    deleteFailed: 'Eroare la ștergerea imaginii.',
    galleryLoadFailed: 'Eroare la încărcarea imaginilor din galerie.',
  },
  errors: {
    fileRequired: 'Te rugăm să selectezi cel puțin un fișier',
    invalidEmail: 'Adresa de email nu este validă',
    uploadFailed: 'Încărcarea a eșuat',
    downloadFailed: 'Descărcarea a eșuat',
    serverError: 'Eroare de server',
    notFound: 'Nu a fost găsit',
    unauthorized: 'Neautorizat',
    forbidden: 'Acces interzis',
    transferNotFound: 'Transferul nu a fost găsit',
    transferExpired: 'Transferul a expirat',
    passwordRequired: 'Este necesară parola',
    invalidPassword: 'Parolă invalidă',
    emailConfigError: 'Configurarea de email nu este completă',
    emailSendError: 'Eroare la trimiterea emailului',
    adminSetupCheckFailed: 'Nu s-a putut verifica configurarea admin',
    unknownError: 'Eroare necunoscută',
    setupFailed: 'Configurarea a eșuat',
    authCheckFailed: 'Eroare la verificarea autentificării',
    logoutError: 'Eroare la deconectare',
    dashboardDataLoadFailed: 'Eroare la încărcarea datelor dashboard',
    error: 'Eroare',
    statsLoadFailed: 'Nu s-au putut încărca statisticile',
    failedToFetchTransfers: 'Nu s-au putut obține transferurile',
    transfersLoadError: 'A apărut o eroare la încărcarea transferurilor',
    emailConfigIncomplete: 'Configurarea de email nu este completă',
    emailConfigCheckEnv: 'Configurarea de email nu este completă. Verifică variabilele de mediu.',
    emailConfig: 'Configurare email',
    emailConfigDevNote: 'Configurația email este incompletă. Pentru dezvoltare, asigură-te că toate variabilele de mediu (SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, EMAIL_FROM) sunt setate în fișierul .env.local. Consultă .env.example pentru ghidaj.',
    deleteTransferFailed: 'Eroare la ștergerea transferului',
    failedToUpdateExpiration: 'Eroare la actualizarea expirării transferului. Te rugăm să încerci din nou.',
  },
  // Email translations
  emails: {
    transfer: {
      subject: 'Fișiere partajate cu tine via {appName} - {transferName}',
      intro: '{hostname} ți-a trimis fișiere prin {appName}!',
      transferName: 'Nume transfer',
      downloadLink: 'Link de descărcare',
      details: 'Detalii transfer',
      fileCount: 'Număr fișiere',
      totalSize: 'Mărime totală',
      expiry: 'Expiră pe {date}',
      noExpiry: 'Nu expiră niciodată',
      note: 'Notă: Acest link {expiryText}.',
      willExpire: 'va expira pe {date}',
      doesNotExpire: 'nu expiră',
      team: 'Echipa {appName}',
      downloadButton: 'Descarcă fișierele',
      allRightsReserved: 'Toate drepturile rezervate - CristianTurcu.ro'
    }
  },
  landing: {
    hero: {
      title: 'Transfer de Fișiere Securizat și Simplu',
      subtitle: 'Partajează fișiere în siguranță, fără efort și fără înregistrare',
      ctaButton: 'Află Mai Multe',
      secondaryButton: 'Începe Acum',
      highlightFeature: 'Nu necesită înregistrare'
    },
    features: {
      title: 'De Ce Să Alegi TinyTransfer',
      subtitle: 'Funcționalități puternice pentru partajarea sigură a fișierelor',
      learnMore: 'Află Mai Multe',
      simplicity: {
        title: 'Partajare Fără Efort',
        description: 'Interfață simplă pentru încărcare și partajare în doar câteva click-uri',
        highlight: 'Nu necesită cunoștințe tehnice'
      },
      control: {
        title: 'Control Total',
        description: 'Setează parole, date de expirare și urmărește descărcările',
        highlight: 'Jurnale de acces detaliate'
      },
      privacy: {
        title: 'Focusat pe Confidențialitate',
        description: 'Nu necesită înregistrare și nu stochează date personale',
        highlight: 'Conform cu GDPR'
      }
    },
    howItWorks: {
      title: 'Cum Funcționează',
      subtitle: 'Transferă fișiere în trei pași simpli',
      step1: {
        title: 'Încarcă',
        description: 'Selectează fișierele și personalizează opțiunile de securitate',
      },
      step2: {
        title: 'Partajează',
        description: 'Primește un link securizat sau trimite-l direct prin email',
      },
      step3: {
        title: 'Monitorizează',
        description: 'Urmărește descărcările și accesează statistici',
      },
    },
    simplicity: {
      title: 'Partajare Fără Efort',
      description1: 'Am proiectat TinyTransfer să fie cât mai simplu posibil, menținând în același timp capacități puternice.',
      description2: 'Caracteristicile noastre prietenoase includ:',
      point1: 'Interfață intuitivă de tip drag-and-drop pentru încărcarea fișierelor',
      point2: 'Partajare simplă de link-uri cu opțiune de livrare prin email',
      point3: 'Nu necesită înregistrare sau creare de cont',
      featuresTitle: 'Interfață Intuitivă',
      workflowTitle: 'Flux de Lucru Simplificat',
      uploadExperience: 'Încărcare Optimizată',
      uploadExperienceDesc: 'Doar trage și plasează fișierele, setează opțiunile și obține un link partajabil în câteva secunde.',
      deviceCompatibility: 'Funcționează Peste Tot',
      deviceCompatibilityDesc: 'Accesează TinyTransfer de pe orice dispozitiv și browser fără a instala nimic.'
    },
    control: {
      title: 'Control Complet',
      description1: 'TinyTransfer îți oferă control complet asupra transferurilor tale de fișiere.',
      description2: 'Caracteristicile de control includ:',
      point1: 'Date de expirare personalizate pentru fișierele cu timp limitat',
      point2: 'Urmărirea descărcărilor pentru a vedea cine ți-a accesat fișierele',
      point3: 'Protecție opțională cu parolă pentru acces restricționat',
      featuresTitle: 'Opțiuni de Control',
      dashboardTitle: 'Panou de Control Complet',
      analytics: 'Statistici Detaliate',
      analyticsDesc: 'Monitorizează numărul de descărcări, vizualizări și IP-uri unice pentru fiecare transfer.',
      management: 'Gestionarea Transferurilor',
      managementDesc: 'Poți șterge sau modifica transferurile oricând este necesar.',
      customization: 'Opțiuni de Personalizare',
      customizationDesc: 'Setează preferințele tale pentru fiecare transfer în parte.'
    },
    privacy: {
      title: 'Axat pe Confidențialitate',
      description1: 'Respectăm confidențialitatea ta și am proiectat sistemul nostru în consecință.',
      description2: 'Caracteristicile noastre de confidențialitate includ:',
      point1: 'Nu necesită înregistrare de cont sau informații personale',
      point2: 'Colectare minimă de date - stocăm doar ce este necesar pentru serviciu',
      point3: 'Ștergerea automată a fișierelor după expirare pentru a minimiza amprenta de date',
      featuresTitle: 'Confidențialitate și Protecția Datelor',
      dataTitle: 'Gestionarea Datelor',
      dataDeletion: 'Ștergere Automată',
      dataDeletionDesc: 'Fișierele sunt șterse automat după expirare pentru a minimiza stocarea datelor.',
      dataControl: 'Control Complet',
      dataControlDesc: 'Ai control complet asupra datelor tale și poți șterge transferurile în orice moment.',
      noTracking: 'Fără Urmărire',
      noTrackingDesc: 'Nu urmărim comportamentul utilizatorilor și nu colectăm date personale inutile.'
    },
    cta: {
      title: 'Gata să Începi',
      description: 'Începe să folosești TinyTransfer astăzi și experimentează transferuri de fișiere sigure, simple și private',
      button: 'Mergi la GitHub'
    },
    getStarted: {
      clone: {
        title: 'Clonează Repository-ul',
        description: 'Clonează repository-ul proiectului de pe GitHub pe mașina ta locală'
      },
      install: {
        title: 'Instalează Dependențele',
        description: 'Navighează în directorul proiectului și instalează toate dependențele necesare'
      },
      run: {
        title: 'Rulează Aplicația',
        description: 'Pornește serverul de dezvoltare pentru a rula aplicația local'
      },
      premiumServices: {
        title: 'Ai Nevoie de Suport Profesional?',
        description: 'Contactează-mă pentru servicii premium de instalare, modificări personalizate sau dezvoltarea de funcționalități specifice.',
        contactButton: 'Contactează pentru Servicii Premium'
      },
      openSource: {
        title: 'Software Open Source',
        description: 'TinyTransfer este complet open source - gratuit pentru utilizare, modificare și distribuire sub licența MIT.'
      }
    },
    footer: {
      about: 'Despre Noi',
      privacy: 'Politica de Confidențialitate',
      terms: 'Termeni și Condiții',
      contact: 'Contact',
    },
    stats: {
      title: 'De încredere pentru utilizatori din întreaga lume',
      transfers: 'Fișiere Transferate',
      users: 'Utilizatori Mulțumiți',
      countries: 'Țări',
      uptime: 'Uptime'
    },
  },
  learnMore: {
    notFound: 'Detaliile funcționalității nu au fost găsite',
    readMore: 'Află Mai Multe',
    overview: {
      title: 'Descoperă TinyTransfer',
      description: 'Platformă de transfer de fișiere sigură, rapidă și simplă, proiectată pentru nevoile tale.'
    },
    simplicity: {
      title: 'Partajare Fără Efort',
      description1: 'Am conceput TinyTransfer să fie cât mai simplu posibil, păstrând în același timp capacități puternice.',
      description2: 'Caracteristicile noastre ușor de utilizat includ:',
      point1: 'Interfață intuitivă drag-and-drop pentru încărcarea fișierelor',
      point2: 'Partajare simplă a linkurilor cu livrare opțională prin email',
      point3: 'Nu necesită înregistrare sau creare de cont',
      featuresTitle: 'Interfață Intuitivă',
      workflowTitle: 'Flux de Lucru Simplificat',
      uploadExperience: 'Încărcare Simplificată',
      uploadExperienceDesc: 'Doar trage și plasează fișierele, setează opțiunile și obține un link partajabil în câteva secunde.',
      deviceCompatibility: 'Funcționează Oriunde',
      deviceCompatibilityDesc: 'Accesează TinyTransfer de pe orice dispozitiv și browser fără a instala nimic.'
    },
    control: {
      title: 'Control Total',
      description1: 'TinyTransfer îți oferă control complet asupra transferurilor de fișiere.',
      description2: 'Caracteristicile de control includ:',
      point1: 'Date de expirare personalizate pentru fișiere cu termen limită',
      point2: 'Urmărirea descărcărilor pentru a vedea cine ți-a accesat fișierele',
      point3: 'Protecție opțională cu parolă pentru acces restricționat',
      featuresTitle: 'Opțiuni de Control',
      dashboardTitle: 'Dashboard Complet',
      analytics: 'Statistici Detaliate',
      analyticsDesc: 'Monitorizează numărul de descărcări, vizualizări și IP-uri unice pentru fiecare transfer.',
      management: 'Administrare Transferuri',
      managementDesc: 'Poți șterge sau modifica transferurile oricând ai nevoie.',
      customization: 'Opțiuni de Personalizare',
      customizationDesc: 'Setează preferințele tale pentru fiecare transfer în parte.'
    },
    privacy: {
      title: 'Focusat pe Confidențialitate',
      description1: 'Respectăm confidențialitatea ta și am conceput sistemul nostru în consecință.',
      description2: 'Caracteristicile noastre de confidențialitate includ:',
      point1: 'Nu necesită înregistrare sau informații personale',
      point2: 'Colectare minimă de date - stocăm doar ce este necesar pentru serviciu',
      point3: 'Ștergere automată a fișierelor după expirare pentru a minimiza amprenta datelor',
      featuresTitle: 'Confidențialitate și Protecția Datelor',
      dataTitle: 'Gestionarea Datelor',
      dataDeletion: 'Ștergere Automată',
      dataDeletionDesc: 'Fișierele sunt șterse automat după expirare pentru a minimiza stocarea datelor.',
      dataControl: 'Control Complet',
      dataControlDesc: 'Ai control complet asupra datelor tale și poți șterge transferurile oricând.',
      noTracking: 'Fără Tracking',
      noTrackingDesc: 'Nu urmărim comportamentul utilizatorilor și nu colectăm date personale inutile.'
    },
    technical: {
      title: 'Tehnologii Avansate',
      description: 'Construit cu tehnologii moderne pentru cea mai bună experiență de utilizare.',
      stack: 'Stack Tehnologic',
      stackDesc: 'Platforma noastră utilizează cele mai recente tehnologii web pentru performanță și fiabilitate.',
      framework: 'Framework Next.js',
      frameworkDesc: 'Construit pe Next.js pentru aplicații web rapide, fiabile și optimizate pentru SEO.',
      typescript: 'TypeScript',
      typescriptDesc: 'Cod cu tipuri sigure care asigură o experiență stabilă și fără erori.',
      tailwind: 'Tailwind CSS',
      tailwindDesc: 'Design modern și responsive care funcționează pe orice dispozitiv.',
      framerMotion: 'Framer Motion',
      framerMotionDesc: 'Animații și tranziții fluide pentru o experiență de utilizare îmbunătățită.'
    }
  },
  stats: {
    title: 'Statistici Transfer',
    transferId: 'ID Transfer',
    archiveName: 'Nume Arhivă',
    totalSize: 'Dimensiune Totală',
    createdAt: 'Creat La',
    expiresAt: 'Expiră La',
    status: 'Status',
    linkViews: 'Vizualizări Link',
    downloads: 'Descărcări',
    uniqueIPs: 'IP-uri Unice (Vizualizări/Descărcări)',
    lastAccessed: 'Ultimul Acces',
    downloadActivity: 'Activitate Descărcări',
    noActivity: 'Nicio activitate de descărcare înregistrată încă.',
    ipAddress: 'Adresă IP',
    timestamp: 'Marcaj Temporal',
    backToTransfers: 'Înapoi la Transferuri'
  },
};

export default ro; 