import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { companyService } from '../services/supabase';
import { Contact, Company, CompanyType, Priority, Gender } from '../types';
import { Search, Mail, Building2, Phone, Plus, X, Camera, Briefcase, Linkedin, Trash2, ChevronDown, Check, UserPlus, Loader2 } from 'lucide-react';
import { getInitials } from '../lib/utils';
import { cn } from '../lib/utils';

// Shadcn UI Components
import { Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../components/ui/Card';
import { Label } from '../components/ui/Label';
import { Avatar, AvatarImage, AvatarFallback } from '../components/ui/Avatar';
import { Badge } from '../components/ui/Badge';

interface ContactWithCompany extends Contact {
    companyId: string;
    companyName: string;
    companyLogo?: string;
}

interface SelectOption { label: string; value: string; }
interface SelectProps {
    value: string;
    onChange: (val: string) => void;
    options: SelectOption[];
    placeholder?: string;
    className?: string;
}

const CustomSelect: React.FC<SelectProps> = ({ value, onChange, options, placeholder, className }) => {
    const [isOpen, setIsOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (ref.current && !ref.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const selectedLabel = options.find(o => o.value === value)?.label;

    return (
        <div className={cn("relative w-full", className)} ref={ref}>
            <Button
                type="button"
                variant="outline"
                onClick={() => setIsOpen(!isOpen)}
                className="w-full justify-between h-10 font-normal"
            >
                <span className={cn("block truncate", !value && "text-muted-foreground")}>
                    {selectedLabel || placeholder || "Sélectionner..."}
                </span>
                <ChevronDown className={cn("h-4 w-4 opacity-50 transition-transform", isOpen && "rotate-180")} />
            </Button>
            {isOpen && (
                <div className="absolute z-50 mt-1 max-h-60 w-full overflow-auto rounded-lg border bg-popover text-popover-foreground shadow-lg animate-in fade-in-0 zoom-in-95">
                    <div className="p-1">
                        {options.map((option) => (
                            <div
                                key={option.value}
                                onClick={() => { onChange(option.value); setIsOpen(false); }}
                                className={cn(
                                    "relative flex cursor-pointer select-none items-center rounded-md px-3 py-2 text-sm outline-none transition-colors hover:bg-accent hover:text-accent-foreground",
                                    value === option.value && "bg-accent"
                                )}
                            >
                                <span className="flex-1 truncate">{option.label}</span>
                                {value === option.value && <Check className="ml-auto h-4 w-4 text-primary" />}
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

export const PeopleDirectory: React.FC = () => {
    const navigate = useNavigate();
    const [contacts, setContacts] = useState<ContactWithCompany[]>([]);
    const [companies, setCompanies] = useState<Company[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isCreatingCompany, setIsCreatingCompany] = useState(false);
    const [editingContact, setEditingContact] = useState<ContactWithCompany | null>(null);
    
    const [contactForm, setContactForm] = useState<Partial<Contact>>({ name: '', emails: [''], role: '', phone: '', avatarUrl: '', linkedinUrl: '', isMainContact: false, gender: 'not_specified' });
    const [selectedCompanyId, setSelectedCompanyId] = useState<string>('');
    const [newCompanyForm, setNewCompanyForm] = useState<{name: string, type: CompanyType, importance: Priority}>({ name: '', type: 'PME', importance: 'medium' });
    const [formError, setFormError] = useState<string>('');
    const [isSaving, setIsSaving] = useState(false);

    const fileInputRef = useRef<HTMLInputElement>(null);

    const loadData = async () => {
        setLoading(true);
        const allCompanies = await companyService.getAll();
        setCompanies(allCompanies);
        
        const allContacts: ContactWithCompany[] = allCompanies.flatMap(company => 
            company.contacts.map(contact => ({
                ...contact,
                companyId: company.id,
                companyName: company.name,
                companyLogo: company.logoUrl
            }))
        );
        allContacts.sort((a, b) => a.name.localeCompare(b.name));
        setContacts(allContacts);
        setLoading(false);
    };

    useEffect(() => { loadData(); }, []);

    const filteredContacts = contacts.filter(c => 
        c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.companyName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.role.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.emails.some(e => e.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    const handleAvatarUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => setContactForm(prev => ({ ...prev, avatarUrl: reader.result as string }));
            reader.readAsDataURL(file);
        }
    };

    const handleAddEmailField = () => setContactForm(prev => ({ ...prev, emails: [...(prev.emails || []), ""] }));
    const handleEmailChange = (idx: number, val: string) => {
        const updatedEmails = [...(contactForm.emails || [])];
        updatedEmails[idx] = val;
        setContactForm({ ...contactForm, emails: updatedEmails });
    };
    const handleRemoveEmailField = (idx: number) => {
        const updatedEmails = (contactForm.emails || []).filter((_, i) => i !== idx);
        setContactForm({ ...contactForm, emails: updatedEmails.length ? updatedEmails : [""] });
    };

    const openCreateModal = () => {
        setEditingContact(null);
        setContactForm({ name: '', emails: [''], role: '', phone: '', avatarUrl: '', linkedinUrl: '', isMainContact: false, gender: 'not_specified' });
        setSelectedCompanyId('');
        setIsCreatingCompany(false);
        setFormError('');
        setIsModalOpen(true);
    };

    const openEditModal = (contact: ContactWithCompany) => {
        setEditingContact(contact);
        setContactForm({
            name: contact.name,
            emails: contact.emails.length ? [...contact.emails] : [''],
            role: contact.role,
            phone: contact.phone,
            avatarUrl: contact.avatarUrl,
            linkedinUrl: contact.linkedinUrl,
            isMainContact: contact.isMainContact,
            gender: contact.gender || 'not_specified'
        });
        setSelectedCompanyId(contact.companyId);
        setIsCreatingCompany(false);
        setFormError('');
        setIsModalOpen(true);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setFormError('');
        
        // Validation
        if (!contactForm.name?.trim()) {
            setFormError('Le nom du contact est requis');
            return;
        }
        
        if (!contactForm.role?.trim()) {
            setFormError('Le poste est requis');
            return;
        }
        
        const cleanedEmails = contactForm.emails?.filter(em => em.trim() !== "") || [];
        if (cleanedEmails.length === 0) {
            setFormError('Au moins un email est requis');
            return;
        }
        
        // Vérifier entreprise pour création
        if (!editingContact) {
            if (isCreatingCompany) {
                if (!newCompanyForm.name?.trim()) {
                    setFormError('Le nom de l\'entreprise est requis');
                    return;
                }
            } else if (!selectedCompanyId) {
                setFormError('Veuillez sélectionner une entreprise ou en créer une nouvelle');
                return;
            }
        }
        
        setIsSaving(true);
        
        try {
            const finalData = { ...contactForm, emails: cleanedEmails };

            if (editingContact) {
                await companyService.updateContact(editingContact.companyId, editingContact.id, finalData);
            } else {
                let targetCompanyId = selectedCompanyId;
                if (isCreatingCompany) {
                    const newCo = await companyService.create(newCompanyForm);
                    targetCompanyId = newCo.id;
                }
                await companyService.addContact(targetCompanyId, finalData);
            }
            setIsModalOpen(false);
            loadData();
            window.dispatchEvent(new Event('companies-updated'));
        } catch (error) { 
            console.error(error);
            setFormError('Une erreur est survenue lors de l\'enregistrement');
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Annuaire Contacts</h1>
                    <p className="text-muted-foreground">Gérez vos contacts et relations professionnelles</p>
                </div>
                <Button onClick={openCreateModal}>
                    <Plus className="h-4 w-4" />
                    Ajouter un contact
                </Button>
            </div>

            {/* Search & Table Card */}
            <Card>
                <CardHeader className="pb-4">
                    <div className="relative max-w-sm">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input 
                            type="text" 
                            placeholder="Rechercher par nom, email ou poste..." 
                            value={searchTerm} 
                            onChange={(e) => setSearchTerm(e.target.value)} 
                            className="pl-9"
                        />
                    </div>
                </CardHeader>
                
                <CardContent className="p-0">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm">
                            <thead className="bg-muted/50 text-muted-foreground border-b">
                                <tr>
                                    <th className="px-6 py-3 font-medium">Contact</th>
                                    <th className="px-6 py-3 font-medium">Poste</th>
                                    <th className="px-6 py-3 font-medium">Entreprise</th>
                                    <th className="px-6 py-3 font-medium">Contact</th>
                                    <th className="px-6 py-3 font-medium text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y">
                                {loading ? (
                                    <tr>
                                        <td colSpan={5} className="px-6 py-12 text-center">
                                            <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2 text-primary" />
                                            <p className="text-sm text-muted-foreground">Chargement...</p>
                                        </td>
                                    </tr>
                                ) : filteredContacts.length === 0 ? (
                                    <tr>
                                        <td colSpan={5} className="px-6 py-12 text-center text-muted-foreground">
                                            Aucun contact trouvé
                                        </td>
                                    </tr>
                                ) : (
                                    filteredContacts.map((contact) => (
                                        <tr 
                                            key={contact.id} 
                                            className="hover:bg-muted/50 transition-colors cursor-pointer" 
                                            onClick={() => openEditModal(contact)}
                                        >
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-3">
                                                    <Avatar>
                                                        {contact.avatarUrl ? (
                                                            <AvatarImage src={contact.avatarUrl} alt={contact.name} />
                                                        ) : null}
                                                        <AvatarFallback>{getInitials(contact.name)}</AvatarFallback>
                                                    </Avatar>
                                                    <div>
                                                        <div className="font-medium">{contact.name}</div>
                                                        {contact.isMainContact && (
                                                            <Badge variant="default" className="mt-1 text-[10px]">Principal</Badge>
                                                        )}
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-muted-foreground">
                                                {contact.role}
                                            </td>
                                            <td className="px-6 py-4">
                                                <div 
                                                    className="flex items-center gap-2 hover:text-primary transition-colors" 
                                                    onClick={(e) => { e.stopPropagation(); navigate(`/company/${contact.companyId}`); }}
                                                >
                                                    <Avatar className="h-6 w-6">
                                                        {contact.companyLogo ? (
                                                            <AvatarImage src={contact.companyLogo} />
                                                        ) : null}
                                                        <AvatarFallback className="text-[10px]">
                                                            <Building2 className="h-3 w-3" />
                                                        </AvatarFallback>
                                                    </Avatar>
                                                    <span className="text-sm">{contact.companyName}</span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="space-y-1">
                                                    {contact.emails.slice(0, 1).map((e, idx) => (
                                                        <span key={idx} className="text-muted-foreground text-xs font-mono block truncate max-w-[180px]">{e}</span>
                                                    ))}
                                                    {contact.phone && (
                                                        <span className="text-muted-foreground text-xs flex items-center gap-1">
                                                            <Phone className="h-3 w-3" />
                                                            {contact.phone}
                                                        </span>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <Button 
                                                    variant="ghost" 
                                                    size="icon"
                                                    onClick={(e) => { 
                                                        e.stopPropagation(); 
                                                        navigate('/inbox', { state: { composeTo: contact.emails[0] } }); 
                                                    }}
                                                >
                                                    <Mail className="h-4 w-4" />
                                                </Button>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </CardContent>
            </Card>

            {/* Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                    <Card className="w-full max-w-lg max-h-[90vh] flex flex-col">
                        <CardHeader className="border-b">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-primary/10 rounded-lg">
                                        <UserPlus className="h-5 w-5 text-primary" />
                                    </div>
                                    <div>
                                        <CardTitle>{editingContact ? 'Modifier le contact' : 'Nouveau contact'}</CardTitle>
                                        <CardDescription>
                                            {editingContact ? 'Modifiez les informations du contact' : 'Ajoutez un nouveau contact à votre annuaire'}
                                        </CardDescription>
                                    </div>
                                </div>
                                <Button variant="ghost" size="icon" onClick={() => setIsModalOpen(false)}>
                                    <X className="h-5 w-5" />
                                </Button>
                            </div>
                        </CardHeader>
                        
                        <form onSubmit={handleSubmit} className="overflow-y-auto flex-1 p-6 space-y-6">
                            {/* Error */}
                            {formError && (
                                <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg text-sm text-destructive">
                                    {formError}
                                </div>
                            )}
                            
                            {/* Avatar */}
                            <div className="flex flex-col items-center gap-3">
                                <div 
                                    onClick={() => fileInputRef.current?.click()} 
                                    className="relative cursor-pointer group"
                                >
                                    <Avatar className="h-20 w-20">
                                        {contactForm.avatarUrl ? (
                                            <AvatarImage src={contactForm.avatarUrl} alt="Preview" />
                                        ) : null}
                                        <AvatarFallback className="text-lg">
                                            <Camera className="h-8 w-8 text-muted-foreground" />
                                        </AvatarFallback>
                                    </Avatar>
                                    <div className="absolute inset-0 rounded-full bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                        <Camera className="h-6 w-6 text-white" />
                                    </div>
                                </div>
                                <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleAvatarUpload} />
                                <span className="text-xs text-muted-foreground">Cliquez pour ajouter une photo</span>
                            </div>

                            {/* Name */}
                            <div className="space-y-2">
                                <Label>Nom complet <span className="text-destructive">*</span></Label>
                                <Input 
                                    type="text" 
                                    value={contactForm.name} 
                                    onChange={e => setContactForm({...contactForm, name: e.target.value})} 
                                    placeholder="ex: Jean Dupont" 
                                />
                            </div>

                            {/* Emails */}
                            <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                    <Label>Emails <span className="text-destructive">*</span></Label>
                                    <Button type="button" variant="ghost" size="sm" onClick={handleAddEmailField}>
                                        <Plus className="h-3 w-3 mr-1" />
                                        Ajouter
                                    </Button>
                                </div>
                                <div className="space-y-2">
                                    {contactForm.emails?.map((email, idx) => (
                                        <div key={idx} className="flex gap-2">
                                            <Input 
                                                type="email" 
                                                value={email} 
                                                onChange={e => handleEmailChange(idx, e.target.value)} 
                                                placeholder="contact@entreprise.fr" 
                                            />
                                            <Button 
                                                type="button" 
                                                variant="outline" 
                                                size="icon"
                                                onClick={() => handleRemoveEmailField(idx)}
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Role & Phone */}
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>Poste <span className="text-destructive">*</span></Label>
                                    <Input 
                                        type="text" 
                                        value={contactForm.role} 
                                        onChange={e => setContactForm({...contactForm, role: e.target.value})} 
                                        placeholder="ex: Directeur Commercial" 
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>Téléphone</Label>
                                    <Input 
                                        type="tel" 
                                        value={contactForm.phone} 
                                        onChange={e => setContactForm({...contactForm, phone: e.target.value})} 
                                        placeholder="01 23 45 67 89" 
                                    />
                                </div>
                            </div>

                            {/* Company */}
                            <div className="space-y-3 pt-4 border-t">
                                <Label>Entreprise {!editingContact && <span className="text-destructive">*</span>}</Label>
                                {editingContact ? (
                                    <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
                                        <Building2 className="h-4 w-4 text-muted-foreground" />
                                        <span className="font-medium">{editingContact.companyName}</span>
                                    </div>
                                ) : (
                                    <div className="space-y-3">
                                        <CustomSelect 
                                            value={selectedCompanyId} 
                                            onChange={(val) => {
                                                setSelectedCompanyId(val);
                                                if (val) setIsCreatingCompany(false);
                                            }} 
                                            options={companies.map(c => ({ value: c.id, label: c.name }))} 
                                            placeholder="Sélectionner une entreprise..." 
                                        />
                                        
                                        <div className="flex items-center gap-2">
                                            <input 
                                                type="checkbox" 
                                                id="isNew" 
                                                checked={isCreatingCompany} 
                                                onChange={e => {
                                                    setIsCreatingCompany(e.target.checked);
                                                    if (e.target.checked) setSelectedCompanyId('');
                                                }} 
                                                className="rounded border-input" 
                                            />
                                            <Label htmlFor="isNew" className="text-sm font-normal cursor-pointer">
                                                Créer une nouvelle entreprise
                                            </Label>
                                        </div>
                                        
                                        {isCreatingCompany && (
                                            <div className="p-4 bg-muted/50 rounded-lg border space-y-3">
                                                <Input 
                                                    type="text" 
                                                    placeholder="Nom de l'entreprise..." 
                                                    value={newCompanyForm.name} 
                                                    onChange={e => setNewCompanyForm({...newCompanyForm, name: e.target.value})} 
                                                />
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                            
                            {/* Actions */}
                            <div className="flex justify-end gap-3 pt-4 border-t">
                                <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)}>
                                    Annuler
                                </Button>
                                <Button type="submit" disabled={isSaving}>
                                    {isSaving ? (
                                        <>
                                            <Loader2 className="h-4 w-4 animate-spin" />
                                            Enregistrement...
                                        </>
                                    ) : (
                                        'Enregistrer'
                                    )}
                                </Button>
                            </div>
                        </form>
                    </Card>
                </div>
            )}
        </div>
    );
};
