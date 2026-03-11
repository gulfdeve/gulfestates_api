import path from 'path';

/**
 * List of dangerous executable and script file extensions to block
 * These files can execute code and pose security risks
 */
export const DANGEROUS_EXTENSIONS = [
  '.exe', '.bat', '.cmd', '.com', '.scr', '.vbs', '.wsf', '.ps1',
  '.sh', '.bash', '.zsh', '.csh',
  '.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs',
  '.php', '.php3', '.php4', '.php5', '.php7', '.php8', '.phtml',
  '.py', '.pyc', '.pyw', '.pyo', '.pyd',
  '.rb', '.rbw',
  '.pl', '.pm', '.cgi',
  '.asp', '.aspx', '.jsp', '.jspx',
  '.html', '.htm', '.xhtml', '.shtml',
  '.dll', '.so', '.dylib', '.sys', '.drv', '.bin',
  '.zip', '.rar', '.7z', '.tar', '.gz', '.bz2', '.xz',
  '.jar', '.war', '.ear', '.sar',
  '.msi', '.deb', '.rpm', '.pkg', '.dmg', '.app', '.apk', '.ipa',
  '.swf', '.fla', '.action',
  '.vb', '.vbs', '.vbe',
  '.ws', '.wsf', '.wsc', '.wsh',
  '.scpt', '.applescript',
  '.lnk', '.url', '.reg',
];

export const isDangerousFile = (filename: string): boolean => {
  const ext = path.extname(filename).toLowerCase();
  return DANGEROUS_EXTENSIONS.includes(ext);
};

export const ALLOWED_IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png','.webp', '.avif', '.gif'];

export const ALLOWED_DOCUMENT_EXTENSIONS = ['.pdf'];

/** Allowed resume/portfolio formats: PDF and DOCX only */
export const ALLOWED_RESUME_EXTENSIONS = ['.pdf', '.docx'];

export const ALLOWED_VIDEO_EXTENSIONS = ['.mp4', '.mov', '.avi', '.mkv', '.webm', '.ogg', '.ogv'];

export const isAllowedImage = (filename: string, mimetype: string): boolean => {
  const ext = path.extname(filename).toLowerCase();
  const allowedMimeTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/avif', 'image/gif'];
  
  return ALLOWED_IMAGE_EXTENSIONS.includes(ext) && allowedMimeTypes.includes(mimetype);
};

export const isAllowedPDF = (filename: string, mimetype: string): boolean => {
  const ext = path.extname(filename).toLowerCase();
  return ext === '.pdf' && mimetype === 'application/pdf';
};

/** Resume/portfolio: PDF and DOCX only */
export const isAllowedResumeOrPortfolio = (filename: string, mimetype: string): boolean => {
  const ext = path.extname(filename).toLowerCase();
  const allowedMimeTypes = [
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
  ];
  return ALLOWED_RESUME_EXTENSIONS.includes(ext) && allowedMimeTypes.includes(mimetype);
};

export const isAllowedVideo = (filename: string, mimetype: string): boolean => {
  const ext = path.extname(filename).toLowerCase();
  const allowedMimeTypes = ['video/mp4', 'video/quicktime', 'video/x-msvideo', 'video/x-matroska', 'video/webm', 'video/ogg'];
  
  return ALLOWED_VIDEO_EXTENSIONS.includes(ext) && allowedMimeTypes.includes(mimetype);
};

