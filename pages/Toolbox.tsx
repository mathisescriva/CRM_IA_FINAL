
import React, { useState, useEffect, useRef } from 'react';
import { Upload, FileText, File, FileSpreadsheet, Image as ImageIcon, Trash2, Search, Plus, ExternalLink, Eye } from 'lucide-react';
import { toolboxService, ToolboxItem } from '../services/toolbox';
import { formatDate } from '../lib/utils';
import { clsx } from 'clsx';

export const Toolbox: React.FC = () => {
    const [items, setItems] = useState<ToolboxItem[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [loading, setLoading] = useState(true);
    const [previewItem, setPreviewItem] = useState<ToolboxItem | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        loadItems();
    }, []);

    const loadItems = () => {
        setItems(toolboxService.getAll());
        setLoading(false);
    };

    const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setLoading(true);
            await toolboxService.add(file);
            loadItems();
            setLoading(false);
        }
    };

    const handleDelete = (id: string) => {
        if (confirm('Are you sure you want to delete this file?')) {
            toolboxService.delete(id);
            loadItems();
        }
    };

    const filteredItems = items.filter(item => 
        item.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const getIcon = (type: string) => {
        switch (type) {
            case 'pdf': return <FileText className="h-6 w-6 text-muted-foreground" />;
            case 'sheet': return <FileSpreadsheet className="h-6 w-6 text-muted-foreground" />;
            case 'image': return <ImageIcon className="h-6 w-6 text-muted-foreground" />;
            case 'doc': return <FileText className="h-6 w-6 text-muted-foreground" />;
            default: return <File className="h-6 w-6 text-muted-foreground" />;
        }
    };

    return (
        <div className="space-y-6 relative h-full flex flex-col">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-foreground">Toolbox</h1>
                    <p className="text-muted-foreground">Manage your global sales assets, brochures, and templates.</p>
                </div>
                <button 
                    onClick={() => fileInputRef.current?.click()}
                    className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-white shadow hover:bg-primary/90 transition-all"
                >
                    <Upload className="mr-2 h-4 w-4" />
                    Upload Document
                </button>
                <input 
                    type="file" 
                    ref={fileInputRef} 
                    className="hidden" 
                    onChange={handleUpload}
                />
            </div>

            <div className="flex items-center gap-4 bg-card p-4 rounded-lg border border-border shadow-sm">
                <Search className="h-5 w-5 text-muted-foreground" />
                <input 
                    type="text" 
                    placeholder="Search documents..." 
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="flex-1 bg-transparent border-none outline-none text-sm text-foreground placeholder:text-muted-foreground"
                />
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
                {filteredItems.map((item) => (
                    <div 
                        key={item.id} 
                        className="group relative bg-card border border-border rounded-lg p-4 hover:shadow-sm transition-all flex flex-col items-center text-center cursor-pointer"
                        onClick={() => setPreviewItem(item)}
                    >
                        <div className="h-16 w-16 bg-muted rounded-lg flex items-center justify-center mb-3 group-hover:scale-105 transition-transform">
                            {getIcon(item.type)}
                        </div>
                        <h3 className="text-sm font-medium text-foreground truncate w-full mb-1" title={item.name}>
                            {item.name}
                        </h3>
                        <p className="text-xs text-muted-foreground">{item.size} • {new Date(item.createdAt).toLocaleDateString()}</p>
                        
                        <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                            <button 
                                onClick={(e) => { e.stopPropagation(); handleDelete(item.id); }}
                                className="p-1.5 bg-card text-muted-foreground hover:text-destructive rounded-md shadow-sm border border-border"
                            >
                                <Trash2 className="h-3.5 w-3.5" />
                            </button>
                        </div>
                    </div>
                ))}
            </div>

            {filteredItems.length === 0 && (
                <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground border-2 border-dashed border-border rounded-lg p-12">
                    <File className="h-12 w-12 mb-3 opacity-20" />
                    <p>No documents found.</p>
                </div>
            )}

            {/* Preview Modal */}
            {previewItem && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/60 backdrop-blur-sm p-4 animate-in fade-in">
                    <div className="bg-card w-full max-w-4xl h-[80vh] rounded-lg shadow-sm flex flex-col overflow-hidden">
                        <div className="flex items-center justify-between p-4 border-b border-border">
                            <div className="flex items-center gap-3">
                                {getIcon(previewItem.type)}
                                <div>
                                    <h3 className="font-semibold text-foreground">{previewItem.name}</h3>
                                    <p className="text-xs text-muted-foreground">{previewItem.size}</p>
                                </div>
                            </div>
                            <div className="flex gap-2">
                                <a 
                                    href={previewItem.url} 
                                    download={previewItem.name}
                                    className="px-3 py-1.5 text-sm font-medium bg-muted hover:bg-muted/80 text-foreground rounded-md transition-colors"
                                >
                                    Download
                                </a>
                                <button 
                                    onClick={() => setPreviewItem(null)}
                                    className="p-1.5 hover:bg-muted rounded-md"
                                >
                                    <span className="sr-only">Close</span>
                                    <svg className="h-5 w-5 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                </button>
                            </div>
                        </div>
                        <div className="flex-1 bg-muted flex items-center justify-center p-4 overflow-auto">
                            {previewItem.type === 'image' ? (
                                <img src={previewItem.url} alt={previewItem.name} className="max-w-full max-h-full object-contain shadow-sm" />
                            ) : previewItem.type === 'pdf' ? (
                                <iframe src={previewItem.url} className="w-full h-full border-none shadow-sm bg-card" title="PDF Preview" />
                            ) : (
                                <div className="text-center text-muted-foreground">
                                    <FileText className="h-16 w-16 mx-auto mb-4 opacity-50" />
                                    <p>Preview not available for this file type.</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
