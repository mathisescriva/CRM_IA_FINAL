/**
 * Google Drive Service - Browse & Upload files to shared Drive folder
 */

const SHARED_FOLDER_ID = (import.meta as any).env?.VITE_GOOGLE_DRIVE_FOLDER_ID || '1HR04UtxDgR-DGF6PWI7opky_3Tfbj7Mh';

export interface DriveFile {
    id: string;
    name: string;
    mimeType: string;
    webViewLink: string;
    iconLink: string;
    size?: string;
    modifiedTime: string;
    createdTime: string;
}

function getAccessToken(): string | null {
    const stored = localStorage.getItem('lexia_gmail_token');
    if (!stored) return null;
    try {
        const parsed = JSON.parse(stored);
        if (parsed.expiry && Date.now() > parsed.expiry - 60000) return null;
        return parsed.access_token;
    } catch {
        return null;
    }
}

async function driveApi(endpoint: string, options: RequestInit = {}): Promise<any> {
    const token = getAccessToken();
    if (!token) throw new Error('Not authenticated with Google');
    const res = await fetch(`https://www.googleapis.com/drive/v3${endpoint}`, {
        ...options,
        headers: {
            'Authorization': `Bearer ${token}`,
            ...(options.headers || {}),
        },
    });
    if (!res.ok) {
        const err = await res.text();
        throw new Error(`Drive API error: ${res.status} - ${err}`);
    }
    return res.json();
}

class GoogleDriveService {

    /**
     * Ensure a subfolder exists inside the shared folder.
     * Returns the folder ID.
     */
    async ensureFolder(folderName: string, parentId: string = SHARED_FOLDER_ID): Promise<string> {
        // Check if folder already exists
        const query = `'${parentId}' in parents and name='${folderName.replace(/'/g, "\\'")}' and mimeType='application/vnd.google-apps.folder' and trashed=false`;
        const res = await driveApi(`/files?q=${encodeURIComponent(query)}&fields=files(id,name)&supportsAllDrives=true&includeItemsFromAllDrives=true`);
        if (res.files && res.files.length > 0) {
            return res.files[0].id;
        }
        const token = getAccessToken();
        if (!token) throw new Error('Not authenticated with Google');
        const createRes = await fetch('https://www.googleapis.com/drive/v3/files?supportsAllDrives=true', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                name: folderName,
                mimeType: 'application/vnd.google-apps.folder',
                parents: [parentId],
            }),
        });
        if (!createRes.ok) {
            const err = await createRes.text();
            throw new Error(`Drive folder creation failed: ${createRes.status} - ${err}`);
        }
        const folder = await createRes.json();
        if (!folder.id) throw new Error('Drive folder creation returned no ID');
        return folder.id;
    }

    /**
     * List files in a specific folder (or root shared folder)
     */
    async listFiles(folderId: string = SHARED_FOLDER_ID, pageSize: number = 50): Promise<DriveFile[]> {
        const query = `'${folderId}' in parents and trashed=false`;
        const fields = 'files(id,name,mimeType,webViewLink,iconLink,size,modifiedTime,createdTime)';
        const res = await driveApi(
            `/files?q=${encodeURIComponent(query)}&fields=${fields}&pageSize=${pageSize}&orderBy=modifiedTime desc&supportsAllDrives=true&includeItemsFromAllDrives=true`
        );
        return res.files || [];
    }

    /**
     * List all files recursively in the shared folder (flat)
     */
    async listAllFiles(pageSize: number = 100): Promise<DriveFile[]> {
        return this.listFiles(SHARED_FOLDER_ID, pageSize);
    }

    /**
     * Search files by name in the shared folder
     */
    async searchFiles(query: string): Promise<DriveFile[]> {
        const q = `'${SHARED_FOLDER_ID}' in parents and name contains '${query.replace(/'/g, "\\'")}' and trashed=false`;
        const fields = 'files(id,name,mimeType,webViewLink,iconLink,size,modifiedTime,createdTime)';
        const res = await driveApi(
            `/files?q=${encodeURIComponent(q)}&fields=${fields}&pageSize=20&orderBy=modifiedTime desc&supportsAllDrives=true&includeItemsFromAllDrives=true`
        );
        return res.files || [];
    }

    /**
     * Upload a file to the shared folder, optionally in a subfolder
     */
    async uploadFile(file: File, subfolderName?: string): Promise<DriveFile> {
        const token = getAccessToken();
        if (!token) throw new Error('Not authenticated with Google');

        let parentId = SHARED_FOLDER_ID;
        if (subfolderName) {
            parentId = await this.ensureFolder(subfolderName);
        }

        // Use multipart upload
        const metadata = {
            name: file.name,
            parents: [parentId],
        };

        const form = new FormData();
        form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
        form.append('file', file);

        const res = await fetch(
            'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,mimeType,webViewLink,iconLink,size,modifiedTime,createdTime&supportsAllDrives=true',
            {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` },
                body: form,
            }
        );

        if (!res.ok) {
            const err = await res.text();
            throw new Error(`Upload failed: ${res.status} - ${err}`);
        }

        return res.json();
    }

    /**
     * Get the file type icon based on mimeType
     */
    getFileType(mimeType: string): string {
        if (mimeType.includes('folder')) return 'folder';
        if (mimeType.includes('spreadsheet') || mimeType.includes('excel')) return 'sheet';
        if (mimeType.includes('document') || mimeType.includes('word')) return 'doc';
        if (mimeType.includes('presentation') || mimeType.includes('powerpoint')) return 'slide';
        if (mimeType.includes('pdf')) return 'pdf';
        if (mimeType.includes('image')) return 'image';
        if (mimeType.includes('video')) return 'video';
        return 'other';
    }

    /**
     * Check if the user is authenticated with Google Drive access
     */
    isAuthenticated(): boolean {
        return !!getAccessToken();
    }

    /**
     * Get the shared folder URL
     */
    getSharedFolderUrl(): string {
        return `https://drive.google.com/drive/folders/${SHARED_FOLDER_ID}`;
    }
}

export const googleDriveService = new GoogleDriveService();
