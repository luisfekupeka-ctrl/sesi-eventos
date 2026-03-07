/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Calendar, 
  Clock, 
  Users, 
  Plus, 
  Edit, 
  Trash2, 
  LogOut, 
  ChevronRight, 
  FileText, 
  Download, 
  Copy,
  CheckCircle2,
  AlertCircle,
  ArrowLeft,
  LayoutDashboard,
  UserCircle,
  Trophy,
  Star,
  Search,
  Filter,
  MapPin,
  TrendingUp,
  PieChart,
  Settings as SettingsIcon,
  X,
  Check
} from 'lucide-react';
import { format, parseISO, isPast, isToday } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';
import { Event, Registration, EventConfigFields, AppSettings, DEFAULT_SETTINGS, CLASSES } from './types';

// --- API Utils ---

const api = {
  getEvents: async () => {
    const res = await fetch('/api/events');
    return res.json();
  },
  saveEvent: async (event: Event) => {
    const res = await fetch('/api/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(event)
    });
    return res.json();
  },
  deleteEvent: async (id: string) => {
    const res = await fetch(`/api/events/${id}`, { method: 'DELETE' });
    return res.json();
  },
  getRegistrations: async (eventId: string) => {
    const res = await fetch(`/api/registrations/${eventId}`);
    return res.json();
  },
  saveRegistration: async (reg: Registration) => {
    const res = await fetch('/api/registrations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(reg)
    });
    return res.json();
  },
  updateRegistrationStatus: async (id: string, status: 'pending' | 'approved') => {
    const res = await fetch(`/api/registrations/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status })
    });
    return res.json();
  },
  getSettings: async () => {
    const res = await fetch('/api/settings');
    return res.json();
  },
  saveSettings: async (settings: AppSettings) => {
    const res = await fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settings)
    });
    return res.json();
  }
};

const AUTH_KEY = 'sesi_auth_token';

// --- Components ---

const Badge = ({ children, variant = 'default' }: { children: React.ReactNode, variant?: 'default' | 'warning' | 'danger' | 'success' | 'accent' }) => {
  const styles = {
    default: 'bg-slate-100 text-slate-600',
    warning: 'bg-yellow-100 text-yellow-700',
    danger: 'bg-red-100 text-red-700',
    success: 'bg-green-100 text-green-700',
    accent: 'bg-accent text-slate-900',
  };
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${styles[variant]}`}>
      {children}
    </span>
  );
};

// --- Main App ---

export default function App() {
  const [view, setView] = useState<'home' | 'details' | 'register' | 'login' | 'admin'>('home');
  const [events, setEvents] = useState<Event[]>([]);
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const init = async () => {
      try {
        const [fetchedEvents, fetchedSettings] = await Promise.all([
          api.getEvents(),
          api.getSettings()
        ]);
        setEvents(fetchedEvents);
        setSettings(fetchedSettings);
        
        const token = localStorage.getItem(AUTH_KEY);
        if (token) {
          setIsAdmin(true);
        }
      } catch (error) {
        console.error("Failed to load data", error);
      } finally {
        setLoading(false);
      }
    };
    init();
  }, []);

  const refreshData = async () => {
    try {
      const [fetchedEvents, fetchedSettings] = await Promise.all([
        api.getEvents(),
        api.getSettings()
      ]);
      setEvents(fetchedEvents);
      setSettings(fetchedSettings);
      if (selectedEvent) {
        const updated = fetchedEvents.find((e: Event) => e.id === selectedEvent.id);
        if (updated) setSelectedEvent(updated);
      }
    } catch (error) {
      console.error("Failed to refresh data", error);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem(AUTH_KEY);
    setIsAdmin(false);
    setView('home');
  };

  return (
    <div className="min-h-screen flex flex-col font-sans bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b-4 border-accent sticky top-0 z-50 shadow-sm">
        <div className="max-w-5xl mx-auto px-4 h-20 flex items-center justify-between">
          <div 
            className="flex items-center gap-3 cursor-pointer" 
            onClick={() => { setView('home'); setSelectedEvent(null); }}
          >
            <div className="w-12 h-12 bg-accent rounded-xl flex items-center justify-center text-slate-900 font-black text-2xl shadow-sm border-2 border-slate-900/5">
              S
            </div>
            <div>
              <h1 className="font-black text-slate-900 text-xl tracking-tight leading-none">SESI Eventos</h1>
              <p className="text-[11px] text-primary font-bold uppercase tracking-widest mt-0.5">Colégio Internacional</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {isAdmin ? (
              <div className="flex items-center gap-3">
                <button 
                  onClick={() => setView('admin')}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-100 text-sm font-bold text-slate-700 hover:bg-accent hover:text-slate-900 transition-all"
                >
                  <LayoutDashboard size={18} />
                  <span className="hidden sm:inline">Painel ADM</span>
                </button>
                <button 
                  onClick={handleLogout}
                  className="p-2 text-slate-400 hover:text-red-500 transition-colors"
                >
                  <LogOut size={22} />
                </button>
              </div>
            ) : (
              <button 
                onClick={() => setView('login')}
                className="px-4 py-2 rounded-lg border-2 border-slate-100 text-sm font-bold text-slate-500 hover:border-accent hover:text-slate-900 transition-all flex items-center gap-2"
              >
                <UserCircle size={18} />
                Área Restrita
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-5xl w-full mx-auto p-4 sm:p-8">
        <AnimatePresence mode="wait">
          {view === 'home' && (
            <HomeView 
              events={events} 
              settings={settings}
              onSelect={(e) => { setSelectedEvent(e); setView('details'); }} 
              loading={loading}
            />
          )}
          {view === 'details' && selectedEvent && (
            <DetailsView 
              event={selectedEvent} 
              onBack={() => setView('home')} 
              onRegister={() => setView('register')}
            />
          )}
          {view === 'register' && selectedEvent && (
            <RegisterView 
              event={selectedEvent} 
              settings={settings}
              onBack={() => setView('details')} 
              onSuccess={() => { refreshData(); setView('home'); }}
            />
          )}
          {view === 'login' && (
            <LoginView 
              onSuccess={() => { setIsAdmin(true); setView('admin'); }} 
              onCancel={() => setView('home')}
            />
          )}
          {view === 'admin' && isAdmin && (
            <AdminDashboard 
              events={events} 
              settings={settings}
              onRefresh={refreshData}
            />
          )}
        </AnimatePresence>
      </main>

      {/* Footer */}
      <footer className="py-12 border-t border-slate-200 bg-white mt-20">
        <div className="max-w-5xl mx-auto px-4">
          <div className="flex flex-col md:flex-row justify-between items-center gap-8">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-accent rounded-lg flex items-center justify-center text-slate-900 font-bold">S</div>
              <span className="font-bold text-slate-900">SESI Internacional</span>
            </div>
            <p className="text-slate-400 text-sm">© {new Date().getFullYear()} Colégio SESI Internacional. Todos os direitos reservados.</p>
            <div className="flex gap-4">
               <div className="w-8 h-8 rounded-full bg-slate-100"></div>
               <div className="w-8 h-8 rounded-full bg-slate-100"></div>
               <div className="w-8 h-8 rounded-full bg-slate-100"></div>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

// --- Views ---

function HomeView({ events, settings, onSelect, loading }: { events: Event[], settings: AppSettings, onSelect: (e: Event) => void, loading: boolean }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [gradeFilter, setGradeFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [showPast, setShowPast] = useState(false);

  if (loading) return <div className="flex justify-center py-20"><div className="animate-spin rounded-full h-12 w-12 border-b-4 border-accent"></div></div>;

  const filteredEvents = events.filter(event => {
    const matchesSearch = event.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                         event.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesGrade = !gradeFilter || event.allowedGrades?.includes(gradeFilter) || (event.allowedGrades?.length === 0);
    const matchesType = !typeFilter || event.type === typeFilter;
    const isEventPast = isPast(parseISO(event.date)) && !isToday(parseISO(event.date));
    
    if (showPast) return isEventPast && matchesSearch && matchesGrade && matchesType;
    return !isEventPast && matchesSearch && matchesGrade && matchesType;
  });

  const showFilters = settings.visibleFilters.search || settings.visibleFilters.grade || settings.visibleFilters.type;

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="space-y-12"
    >
      <div className="relative py-12 px-8 rounded-3xl bg-primary overflow-hidden text-white shadow-xl">
        <div className="absolute top-0 right-0 p-8 opacity-10">
          <Star size={120} className="text-accent fill-accent" />
        </div>
        <div className="relative z-10 max-w-2xl space-y-4">
          <Badge variant="accent">NOVIDADES</Badge>
          <h2 className="text-4xl sm:text-5xl font-black tracking-tight">Participe dos nossos eventos!</h2>
          <p className="text-blue-100 text-lg font-medium">Inscreva-se nas oficinas, palestras e atividades do Colégio SESI Internacional.</p>
        </div>
      </div>

      {/* Search and Filters */}
      {showFilters && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
          {settings.visibleFilters.search && (
            <div className="md:col-span-2 relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
              <input 
                type="text" 
                placeholder="Buscar eventos por nome..." 
                className="input-field pl-12 py-3"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          )}
          {settings.visibleFilters.grade && (
            <div className="relative">
              <Filter className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <select 
                className="input-field pl-12 py-3 appearance-none"
                value={gradeFilter}
                onChange={(e) => setGradeFilter(e.target.value)}
              >
                <option value="">Todas as séries</option>
                {settings.grades.map(g => <option key={g} value={g}>{g}</option>)}
              </select>
            </div>
          )}
          {settings.visibleFilters.type && (
            <div className="relative">
              <select 
                className="input-field py-3"
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
              >
                <option value="">Todos os tipos</option>
                {settings.eventTypes.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          )}
        </div>
      )}

      {/* Quick Grade Filters */}
      {settings.visibleFilters.quickGrades && (
        <div className="flex flex-wrap gap-3">
          <button 
            onClick={() => setGradeFilter('')}
            className={`px-6 py-2 rounded-full text-sm font-bold transition-all ${gradeFilter === '' ? 'bg-accent text-slate-900 shadow-md' : 'bg-white text-slate-400 hover:text-slate-600 border border-slate-100'}`}
          >
            Todos
          </button>
          {settings.grades.map(g => (
            <button 
              key={g}
              onClick={() => setGradeFilter(g)}
              className={`px-6 py-2 rounded-full text-sm font-bold transition-all ${gradeFilter === g ? 'bg-accent text-slate-900 shadow-md' : 'bg-white text-slate-400 hover:text-slate-600 border border-slate-100'}`}
            >
              {g}
            </button>
          ))}
        </div>
      )}

      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h3 className="text-2xl font-black text-slate-900 flex items-center gap-2">
            <Calendar className="text-accent" />
            {showPast ? 'Eventos Encerrados' : 'Próximos Eventos'}
          </h3>
          <button 
            onClick={() => setShowPast(!showPast)}
            className="text-sm font-bold text-primary hover:underline"
          >
            {showPast ? 'Ver próximos eventos' : 'Ver eventos encerrados'}
          </button>
        </div>

        {filteredEvents.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-3xl border-2 border-dashed border-slate-200">
            <Calendar className="mx-auto text-slate-200 mb-4" size={64} />
            <p className="text-slate-400 font-bold text-lg">Nenhum evento encontrado.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {filteredEvents.map((event) => {
              const isFull = event.currentRegistrations >= event.maxCapacity;
              const isEventPast = isPast(parseISO(event.date)) && !isToday(parseISO(event.date));
              return (
                <motion.div 
                  key={event.id}
                  whileHover={!isEventPast ? { y: -8 } : {}}
                  className={`card flex flex-col cursor-pointer group hover:border-accent transition-all duration-300 ${isEventPast ? 'opacity-75 grayscale-[0.5]' : ''}`}
                  onClick={() => onSelect(event)}
                >
                  <div className={`h-3 ${isEventPast ? 'bg-slate-300' : 'bg-accent'}`}></div>
                  <div className="p-6 space-y-5 flex-1">
                    <div className="flex justify-between items-start">
                      <div className="flex flex-col gap-1">
                        {isEventPast ? (
                          <Badge variant="danger">Encerrado</Badge>
                        ) : (
                          <Badge variant={isFull ? 'danger' : 'success'}>
                            {isFull ? 'Vagas esgotadas' : `Restam ${event.maxCapacity - event.currentRegistrations} vagas`}
                          </Badge>
                        )}
                        {event.allowedGrades && event.allowedGrades.length > 0 && (
                          <Badge variant="warning">Restrito</Badge>
                        )}
                      </div>
                      <span className="text-[10px] font-black text-primary uppercase tracking-widest bg-blue-50 px-2 py-1 rounded">{event.type}</span>
                    </div>
                    
                    <div>
                      <h3 className="text-xl font-black text-slate-900 group-hover:text-primary transition-colors leading-tight">{event.name}</h3>
                      <p className="text-slate-500 text-sm line-clamp-2 mt-2 font-medium">{event.description}</p>
                    </div>

                    <div className="space-y-3 pt-2">
                      <div className="flex items-center gap-3 text-slate-600 text-sm font-bold">
                        <div className="w-8 h-8 rounded-lg bg-slate-50 flex items-center justify-center text-accent">
                          <Calendar size={16} />
                        </div>
                        <span>{format(parseISO(event.date), "dd 'de' MMMM", { locale: ptBR })}</span>
                      </div>
                      <div className="flex items-center gap-3 text-slate-600 text-sm font-bold">
                        <div className="w-8 h-8 rounded-lg bg-slate-50 flex items-center justify-center text-accent">
                          <Clock size={16} />
                        </div>
                        <span>{event.startTime} • {event.duration}</span>
                      </div>
                    </div>
                  </div>
                  <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between group-hover:bg-accent/10 transition-colors">
                    <span className="text-xs font-black text-slate-400 uppercase tracking-widest group-hover:text-slate-900">Ver detalhes</span>
                    <ChevronRight size={18} className="text-slate-300 group-hover:text-slate-900 group-hover:translate-x-1 transition-all" />
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </motion.div>
  );
}

function DetailsView({ event, onBack, onRegister }: { event: Event, onBack: () => void, onRegister: () => void }) {
  const isFull = event.currentRegistrations >= event.maxCapacity;

  return (
    <motion.div 
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="max-w-4xl mx-auto space-y-8"
    >
      <button onClick={onBack} className="flex items-center gap-2 text-slate-400 font-bold hover:text-primary transition-colors">
        <ArrowLeft size={20} />
        <span>Voltar para lista</span>
      </button>

      <div className="card overflow-visible">
        <div className="relative">
          <div className="h-64 bg-primary flex items-center justify-center overflow-hidden rounded-t-xl">
             <div className="absolute inset-0 opacity-20">
               <div className="grid grid-cols-12 gap-4 p-8">
                 {Array.from({ length: 48 }).map((_, i) => (
                   <div key={i} className="w-4 h-4 rounded-full bg-accent" />
                 ))}
               </div>
             </div>
             <Trophy size={80} className="text-accent relative z-10 drop-shadow-lg" />
          </div>
          
          <div className="absolute -bottom-6 left-8 right-8">
            <div className="bg-white p-6 rounded-2xl shadow-xl border border-slate-100 flex flex-col sm:flex-row justify-between items-center gap-4">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-accent rounded-xl flex items-center justify-center text-slate-900">
                  <Calendar size={24} />
                </div>
                <div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Data do Evento</p>
                  <p className="font-black text-slate-900 text-lg">{format(parseISO(event.date), "dd 'de' MMMM, yyyy", { locale: ptBR })}</p>
                </div>
              </div>
              <div className="h-10 w-[2px] bg-slate-100 hidden sm:block"></div>
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-accent rounded-xl flex items-center justify-center text-slate-900">
                  <Clock size={24} />
                </div>
                <div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Horário</p>
                  <p className="font-black text-slate-900 text-lg">{event.startTime} ({event.duration})</p>
                </div>
              </div>
              {event.location && (
                <>
                  <div className="h-10 w-[2px] bg-slate-100 hidden sm:block"></div>
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-accent rounded-xl flex items-center justify-center text-slate-900">
                      <MapPin size={24} />
                    </div>
                    <div>
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Local</p>
                      <p className="font-black text-slate-900 text-lg">{event.location}</p>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="p-8 pt-16 space-y-10">
          <div className="space-y-6">
            <div className="flex flex-wrap gap-2">
              <Badge variant="accent">{event.type}</Badge>
              <Badge variant="default">Público: {event.targetAudience}</Badge>
              {event.allowedGrades && event.allowedGrades.length > 0 && (
                <Badge variant="warning">Séries: {event.allowedGrades.join(', ')}</Badge>
              )}
              {isFull && <Badge variant="danger">VAGAS ESGOTADAS</Badge>}
            </div>
            <h2 className="text-4xl sm:text-5xl font-black text-slate-900 tracking-tight leading-tight">{event.name}</h2>
            <p className="text-slate-600 leading-relaxed text-xl font-medium">{event.description}</p>
          </div>

          <div className="bg-slate-50 rounded-3xl p-8 border border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-8">
            <div className="space-y-1 text-center sm:text-left">
              <p className="text-slate-400 font-bold uppercase tracking-widest text-xs">Vagas Disponíveis</p>
              <p className="text-3xl font-black text-slate-900">
                {isFull ? '0' : event.maxCapacity - event.currentRegistrations} <span className="text-lg text-slate-400 font-bold">/ {event.maxCapacity}</span>
              </p>
            </div>
            <button 
              onClick={onRegister}
              disabled={isFull}
              className="w-full sm:w-auto btn-accent py-5 px-12 text-lg flex items-center justify-center gap-3 rounded-2xl"
            >
              {isFull ? 'Inscrições Encerradas' : 'Garantir minha vaga'}
              {!isFull && <ChevronRight size={24} />}
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function RegisterView({ event, onBack, onSuccess, settings }: { event: Event, onBack: () => void, onSuccess: () => void, settings: AppSettings }) {
  const config: EventConfigFields = JSON.parse(event.configFields);
  const [formData, setFormData] = useState<any>({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Grade restriction check (Immediate validation)
    const hasRestriction = Array.isArray(event.allowedGrades) && event.allowedGrades.length > 0;
    const userGrade = formData.serie || formData.parentStudentGrade;

    if (hasRestriction) {
      if (!userGrade) {
        setError('A série do aluno é obrigatória para este evento.');
        return;
      }
      if (!event.allowedGrades?.includes(userGrade)) {
        setError('Este evento não está disponível para sua série.');
        return;
      }
    }

    setSubmitting(true);
    setError(null);
    
    try {
      const eventRegs = await api.getRegistrations(event.id);
      
      // Duplicate prevention (by name and grade)
      const isDuplicate = eventRegs.some((r: Registration) => {
        const rName = (r.formData.nome + (r.formData.sobrenome || '')).toLowerCase().replace(/\s/g, '');
        const fName = (formData.nome + (formData.sobrenome || '')).toLowerCase().replace(/\s/g, '');
        const rParentStudent = (r.formData.aluno_nome || '').toLowerCase().replace(/\s/g, '');
        const fParentStudent = (formData.aluno_nome || '').toLowerCase().replace(/\s/g, '');
        
        return (rName === fName && rName !== '') || (rParentStudent === fParentStudent && rParentStudent !== '');
      });

      if (isDuplicate) {
        setError('Você já possui uma inscrição realizada para este evento.');
        setSubmitting(false);
        return;
      }

      if (eventRegs.length >= event.maxCapacity) {
        setError('Infelizmente as vagas acabaram enquanto você preenchia o formulário.');
        setSubmitting(false);
        return;
      }

      const newReg: Registration = {
        id: crypto.randomUUID(),
        eventId: event.id,
        formData,
        status: event.approvalMode === 'manual' ? 'pending' : 'approved',
        createdAt: new Date().toISOString()
      };

      await api.saveRegistration(newReg);
      setSuccess(true);
      setTimeout(() => {
        onSuccess();
      }, 2000);
    } catch (err) {
      console.error(err);
      setError('Ocorreu um erro ao processar sua inscrição. Tente novamente.');
      setSubmitting(false);
    }
  };

  const updateField = (field: string, value: string) => {
    setFormData((prev: any) => ({ ...prev, [field]: value }));
  };

  if (success) {
    return (
      <motion.div 
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="max-w-md mx-auto py-20 text-center space-y-6"
      >
        <div className="w-24 h-24 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto shadow-inner">
          <CheckCircle2 size={48} />
        </div>
        <div className="space-y-2">
          <h2 className="text-3xl font-black text-slate-900">Inscrição realizada com sucesso!</h2>
          <p className="text-slate-500 font-bold">Você será redirecionado em instantes...</p>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="max-w-2xl mx-auto"
    >
      <div className="card p-10 space-y-10 border-t-8 border-accent">
        <div className="text-center space-y-3">
          <h2 className="text-3xl font-black text-slate-900 tracking-tight">Formulário de Inscrição</h2>
          <p className="text-primary font-bold text-lg">{event.name}</p>
        </div>

        {error && (
          <div className="bg-red-50 text-red-600 p-5 rounded-2xl flex items-center gap-4 text-sm font-bold border border-red-100">
            <AlertCircle size={24} />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-10">
          {/* Aluno Fields */}
          {(config.studentName || config.studentSurname || config.studentGrade || config.studentClass || config.studentEmail || config.studentPhone || config.studentCpf) && (
            <div className="space-y-6">
              <h3 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-3">
                <div className="h-[2px] flex-1 bg-slate-100"></div>
                Dados do Aluno
                <div className="h-[2px] flex-1 bg-slate-100"></div>
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                {config.studentName && (
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700">Nome</label>
                    <input required type="text" className="input-field py-3" onChange={(e) => updateField('nome', e.target.value)} />
                  </div>
                )}
                {config.studentSurname && (
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700">Sobrenome</label>
                    <input required type="text" className="input-field py-3" onChange={(e) => updateField('sobrenome', e.target.value)} />
                  </div>
                )}
                {config.studentGrade && (
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700">Série</label>
                    <select required className="input-field py-3" onChange={(e) => updateField('serie', e.target.value)}>
                      <option value="">Selecione...</option>
                      {settings.grades.map(g => <option key={g} value={g}>{g}</option>)}
                    </select>
                  </div>
                )}
                {config.studentClass && (
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700">Turma</label>
                    <select required className="input-field py-3" onChange={(e) => updateField('turma', e.target.value)}>
                      <option value="">Selecione...</option>
                      {CLASSES.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                )}
                {config.studentEmail && (
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700">Email do Aluno</label>
                    <input required type="email" className="input-field py-3" onChange={(e) => updateField('aluno_email', e.target.value)} />
                  </div>
                )}
                {config.studentPhone && (
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700">Telefone do Aluno</label>
                    <input required type="tel" className="input-field py-3" onChange={(e) => updateField('aluno_telefone', e.target.value)} />
                  </div>
                )}
                {config.studentCpf && (
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700">CPF/RG do Aluno</label>
                    <input required type="text" className="input-field py-3" onChange={(e) => updateField('aluno_documento', e.target.value)} />
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Responsavel Fields */}
          {(config.parentName || config.parentPhone || config.parentEmail || config.parentCpf || config.parentStudentName || config.parentStudentGrade || config.parentStudentClass) && (
            <div className="space-y-6">
              <h3 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-3">
                <div className="h-[2px] flex-1 bg-slate-100"></div>
                Dados do Responsável
                <div className="h-[2px] flex-1 bg-slate-100"></div>
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                {config.parentName && (
                  <div className="space-y-2 sm:col-span-2">
                    <label className="text-sm font-bold text-slate-700">Nome do Responsável</label>
                    <input required type="text" className="input-field py-3" onChange={(e) => updateField('responsavel_nome', e.target.value)} />
                  </div>
                )}
                {config.parentEmail && (
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700">Email de Contato</label>
                    <input required type="email" className="input-field py-3" onChange={(e) => updateField('responsavel_email', e.target.value)} />
                  </div>
                )}
                {config.parentPhone && (
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700">Telefone de Contato</label>
                    <input required type="tel" className="input-field py-3" onChange={(e) => updateField('responsavel_telefone', e.target.value)} />
                  </div>
                )}
                {config.parentCpf && (
                  <div className="space-y-2 sm:col-span-2">
                    <label className="text-sm font-bold text-slate-700">CPF/RG do Responsável</label>
                    <input required type="text" className="input-field py-3" onChange={(e) => updateField('responsavel_documento', e.target.value)} />
                  </div>
                )}
                {config.parentStudentName && (
                  <div className="space-y-2 sm:col-span-2">
                    <label className="text-sm font-bold text-slate-700">Nome do Aluno</label>
                    <input required type="text" className="input-field py-3" onChange={(e) => updateField('aluno_nome', e.target.value)} />
                  </div>
                )}
                {config.parentStudentGrade && (
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700">Série do Aluno</label>
                    <select required className="input-field py-3" onChange={(e) => updateField('parentStudentGrade', e.target.value)}>
                      <option value="">Selecione...</option>
                      {settings.grades.map(g => <option key={g} value={g}>{g}</option>)}
                    </select>
                  </div>
                )}
                {config.parentStudentClass && (
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700">Turma do Aluno</label>
                    <select required className="input-field py-3" onChange={(e) => updateField('parentStudentClass', e.target.value)}>
                      <option value="">Selecione...</option>
                      {CLASSES.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="flex flex-col sm:flex-row gap-4 pt-6">
            <button type="button" onClick={onBack} className="flex-1 px-8 py-4 border-2 border-slate-100 rounded-2xl text-slate-500 font-bold hover:bg-slate-50 transition-colors">
              Cancelar
            </button>
            <button type="submit" disabled={submitting} className="flex-1 btn-accent py-4 text-lg rounded-2xl">
              {submitting ? 'Processando...' : 'Confirmar Inscrição'}
            </button>
          </div>
        </form>
      </div>
    </motion.div>
  );
}

function LoginView({ onSuccess, onCancel }: { onSuccess: () => void, onCancel: () => void }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    
    setTimeout(() => {
      const trimmedUser = username.trim().toLowerCase();
      const trimmedPass = password.trim();

      if (trimmedUser === "admin" && trimmedPass === "sesi123") {
        localStorage.setItem(AUTH_KEY, 'fake-token');
        onSuccess();
      } else {
        setError('Usuário ou senha incorretos.');
        setLoading(false);
      }
    }, 600);
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="max-w-md mx-auto py-12"
    >
      <div className="card p-10 space-y-10 border-b-8 border-accent">
        <div className="text-center space-y-4">
          <div className="w-20 h-20 bg-accent rounded-3xl flex items-center justify-center text-slate-900 mx-auto shadow-lg">
            <LayoutDashboard size={40} />
          </div>
          <h2 className="text-3xl font-black text-slate-900 tracking-tight">Área Administrativa</h2>
          <p className="text-slate-400 font-medium">Acesso restrito para organizadores.</p>
        </div>

        {error && (
          <div className="bg-red-50 text-red-600 p-4 rounded-xl text-sm font-bold flex items-center gap-3 border border-red-100">
            <AlertCircle size={20} />
            {error}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-6">
          <div className="space-y-2">
            <label className="text-sm font-bold text-slate-700">Usuário</label>
            <input 
              required 
              type="text" 
              className="input-field py-3" 
              value={username} 
              onChange={(e) => setUsername(e.target.value)} 
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-bold text-slate-700">Senha</label>
            <input 
              required 
              type="password" 
              className="input-field py-3" 
              value={password} 
              onChange={(e) => setPassword(e.target.value)} 
            />
          </div>
          <div className="flex flex-col gap-4 pt-4">
            <button type="submit" disabled={loading} className="btn-accent w-full py-4 text-lg rounded-2xl">
              {loading ? 'Entrando...' : 'Entrar no Painel'}
            </button>
            <button type="button" onClick={onCancel} className="text-sm font-bold text-slate-400 hover:text-primary transition-colors">
              Voltar para o site
            </button>
          </div>
        </form>
      </div>
    </motion.div>
  );
}

// --- Admin Dashboard ---

function AdminDashboard({ events, settings, onRefresh }: { events: Event[], settings: AppSettings, onRefresh: () => void }) {
  const [activeTab, setActiveTab] = useState<'list' | 'create' | 'participants' | 'stats' | 'settings'>('list');
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [participants, setParticipants] = useState<Registration[]>([]);
  const [editingEvent, setEditingEvent] = useState<Event | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [copyStatus, setCopyStatus] = useState<string | null>(null);

  // Settings state
  const [localSettings, setLocalSettings] = useState<AppSettings>(settings);
  const [newType, setNewType] = useState('');
  const [newGrade, setNewGrade] = useState('');
  const [adminSearchTerm, setAdminSearchTerm] = useState('');
  const [participantSearchTerm, setParticipantSearchTerm] = useState('');

  useEffect(() => {
    setLocalSettings(settings);
  }, [settings]);

  const saveSettings = async (updated: AppSettings) => {
    try {
      await api.saveSettings(updated);
      setLocalSettings(updated);
      onRefresh();
    } catch (err) {
      console.error("Failed to save settings", err);
    }
  };

  const toggleFilter = (filter: keyof AppSettings['visibleFilters']) => {
    const updated = {
      ...localSettings,
      visibleFilters: {
        ...localSettings.visibleFilters,
        [filter]: !localSettings.visibleFilters[filter]
      }
    };
    saveSettings(updated);
  };

  const addType = () => {
    if (!newType.trim()) return;
    if (localSettings.eventTypes.includes(newType.trim())) return;
    const updated = {
      ...localSettings,
      eventTypes: [...localSettings.eventTypes, newType.trim()]
    };
    saveSettings(updated);
    setNewType('');
  };

  const removeType = (type: string) => {
    const updated = {
      ...localSettings,
      eventTypes: localSettings.eventTypes.filter(t => t !== type)
    };
    saveSettings(updated);
  };

  const addGrade = () => {
    if (!newGrade.trim()) return;
    if (localSettings.grades.includes(newGrade.trim())) return;
    const updated = {
      ...localSettings,
      grades: [...localSettings.grades, newGrade.trim()]
    };
    saveSettings(updated);
    setNewGrade('');
  };

  const removeGrade = (grade: string) => {
    const updated = {
      ...localSettings,
      grades: localSettings.grades.filter(g => g !== grade)
    };
    saveSettings(updated);
  };

  const fetchParticipants = async (eventId: string) => {
    try {
      const eventRegs = await api.getRegistrations(eventId);
      setParticipants(eventRegs);
    } catch (err) {
      console.error("Failed to fetch participants", err);
    }
  };

  const updateRegistrationStatus = async (regId: string, status: 'approved' | 'pending') => {
    try {
      await api.updateRegistrationStatus(regId, status);
      if (selectedEvent) fetchParticipants(selectedEvent.id);
      onRefresh();
    } catch (err) {
      console.error("Failed to update status", err);
    }
  };

  const handleCreateOrUpdate = async (formData: any) => {
    try {
      if (editingEvent) {
        await api.saveEvent({ ...editingEvent, ...formData });
      } else {
        const newEvent = {
          ...formData,
          id: crypto.randomUUID(),
          createdAt: new Date().toISOString(),
          currentRegistrations: 0
        };
        await api.saveEvent(newEvent);
      }
      
      onRefresh();
      setActiveTab('list');
      setEditingEvent(null);
    } catch (err) {
      console.error("Failed to save event", err);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await api.deleteEvent(id);
      onRefresh();
      setDeletingId(null);
    } catch (err) {
      console.error("Failed to delete event", err);
    }
  };

  const exportExcel = (event: Event, data: Registration[]) => {
    const rows = data.map(r => ({
      'Data Inscrição': format(parseISO(r.createdAt), 'dd/MM/yyyy HH:mm'),
      ...r.formData
    }));
    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Participantes");
    XLSX.writeFile(workbook, `participantes_${event.name.replace(/\s+/g, '_')}.xlsx`);
  };

  const exportPDF = (event: Event, data: Registration[]) => {
    const doc = new jsPDF();
    doc.text(`Participantes: ${event.name}`, 14, 15);
    doc.setFontSize(10);
    doc.text(`Data: ${format(parseISO(event.date), 'dd/MM/yyyy')}`, 14, 22);

    if (data.length === 0) {
      doc.text("Nenhum participante inscrito.", 14, 30);
    } else {
      const headers = Object.keys(data[0].formData);
      const body = data.map(r => Object.values(r.formData));
      (doc as any).autoTable({
        head: [headers],
        body: body,
        startY: 30,
      });
    }

    doc.save(`participantes_${event.name.replace(/\s+/g, '_')}.pdf`);
  };

  const copyToClipboard = (data: Registration[]) => {
    if (data.length === 0) {
      setCopyStatus('Nenhum dado para copiar.');
      setTimeout(() => setCopyStatus(null), 3000);
      return;
    }
    const headers = Object.keys(data[0].formData).join('\t');
    const text = data.map(r => Object.values(r.formData).join('\t')).join('\n');
    navigator.clipboard.writeText(headers + '\n' + text);
    setCopyStatus('Lista copiada com sucesso!');
    setTimeout(() => setCopyStatus(null), 3000);
  };

  return (
    <div className="space-y-10">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
        <div className="space-y-1">
          <h2 className="text-3xl font-black text-slate-900 tracking-tight">Painel de Gestão</h2>
          <p className="text-slate-400 font-bold text-sm uppercase tracking-widest">Organização de Eventos SESI</p>
          {copyStatus && (
            <motion.div 
              initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
              className="text-xs font-bold text-primary bg-blue-50 px-3 py-1 rounded-full w-fit mt-2"
            >
              {copyStatus}
            </motion.div>
          )}
        </div>
        <button 
          onClick={() => { setEditingEvent(null); setActiveTab('create'); }}
          className="btn-accent flex items-center justify-center gap-2 py-3 px-6 rounded-xl shadow-lg hover:shadow-accent/20"
        >
          <Plus size={20} />
          Criar Novo Evento
        </button>
      </div>

      <div className="flex gap-2 p-1 bg-slate-100 rounded-2xl w-fit">
        <button 
          onClick={() => setActiveTab('list')}
          className={`px-6 py-2.5 text-sm font-black rounded-xl transition-all ${activeTab === 'list' ? 'bg-white text-primary shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
        >
          Lista de Eventos
        </button>
        <button 
          onClick={() => setActiveTab('stats')}
          className={`px-6 py-2.5 text-sm font-black rounded-xl transition-all ${activeTab === 'stats' ? 'bg-white text-primary shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
        >
          Estatísticas
        </button>
        <button 
          onClick={() => setActiveTab('settings')}
          className={`px-6 py-2.5 text-sm font-black rounded-xl transition-all ${activeTab === 'settings' ? 'bg-white text-primary shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
        >
          Configurações
        </button>
        {(activeTab === 'participants' || activeTab === 'create') && (
          <button className="px-6 py-2.5 text-sm font-black rounded-xl bg-white text-primary shadow-sm">
            {activeTab === 'participants' ? 'Participantes' : (editingEvent ? 'Editar' : 'Novo')}
          </button>
        )}
      </div>

      <AnimatePresence mode="wait">
        {activeTab === 'settings' && (
          <motion.div 
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="space-y-8"
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* Filter Visibility */}
              <div className="card p-8 space-y-6">
                <h3 className="text-lg font-black text-slate-900 flex items-center gap-3">
                  <Filter size={20} className="text-accent" />
                  Filtros da Página Inicial
                </h3>
                <div className="space-y-4">
                  {[
                    { id: 'search', label: 'Barra de Busca' },
                    { id: 'grade', label: 'Filtro de Série (Dropdown)' },
                    { id: 'type', label: 'Filtro de Tipo' },
                    { id: 'quickGrades', label: 'Botões Rápidos de Série' },
                  ].map((f) => (
                    <label key={f.id} className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl cursor-pointer hover:bg-slate-100 transition-colors">
                      <span className="font-bold text-slate-700">{f.label}</span>
                      <div className="relative inline-flex items-center cursor-pointer">
                        <input 
                          type="checkbox" 
                          className="sr-only peer"
                          checked={localSettings.visibleFilters[f.id as keyof AppSettings['visibleFilters']]}
                          onChange={() => toggleFilter(f.id as keyof AppSettings['visibleFilters'])}
                        />
                        <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-accent"></div>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              {/* Event Types */}
              <div className="card p-8 space-y-6">
                <h3 className="text-lg font-black text-slate-900 flex items-center gap-3">
                  <Star size={20} className="text-accent" />
                  Tipos de Eventos
                </h3>
                <div className="space-y-4">
                  <div className="flex gap-2">
                    <input 
                      type="text" 
                      placeholder="Novo tipo..." 
                      className="input-field py-2"
                      value={newType}
                      onChange={(e) => setNewType(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && addType()}
                    />
                    <button onClick={addType} className="btn-accent p-2 rounded-xl">
                      <Plus size={20} />
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {localSettings.eventTypes.map(type => (
                      <span key={type} className="flex items-center gap-2 px-3 py-1.5 bg-slate-100 text-slate-700 rounded-lg font-bold text-xs">
                        {type}
                        <button onClick={() => removeType(type)} className="text-slate-400 hover:text-red-500">
                          <X size={14} />
                        </button>
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              {/* Grades */}
              <div className="card p-8 space-y-6">
                <h3 className="text-lg font-black text-slate-900 flex items-center gap-3">
                  <Users size={20} className="text-accent" />
                  Séries / Anos
                </h3>
                <div className="space-y-4">
                  <div className="flex gap-2">
                    <input 
                      type="text" 
                      placeholder="Nova série..." 
                      className="input-field py-2"
                      value={newGrade}
                      onChange={(e) => setNewGrade(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && addGrade()}
                    />
                    <button onClick={addGrade} className="btn-accent p-2 rounded-xl">
                      <Plus size={20} />
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {localSettings.grades.map(grade => (
                      <span key={grade} className="flex items-center gap-2 px-3 py-1.5 bg-slate-100 text-slate-700 rounded-lg font-bold text-xs">
                        {grade}
                        <button onClick={() => removeGrade(grade)} className="text-slate-400 hover:text-red-500">
                          <X size={14} />
                        </button>
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {activeTab === 'list' && (
          <motion.div 
            key="list"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="space-y-6"
          >
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
              <input 
                type="text" 
                placeholder="Pesquisar eventos por nome ou tipo..." 
                className="input-field pl-12 py-3 bg-white shadow-sm"
                value={adminSearchTerm}
                onChange={(e) => setAdminSearchTerm(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-1 gap-6">
              {events.filter(e => 
                e.name.toLowerCase().includes(adminSearchTerm.toLowerCase()) || 
                e.type.toLowerCase().includes(adminSearchTerm.toLowerCase())
              ).map(event => (
                <div key={event.id} className="card p-6 flex flex-col md:flex-row md:items-center justify-between gap-6 hover:border-accent transition-all">
                <div className="flex items-center gap-6">
                  <div className="w-16 h-16 bg-slate-50 rounded-2xl flex flex-col items-center justify-center text-primary border border-slate-100">
                    <span className="text-[10px] font-black uppercase tracking-widest">{format(parseISO(event.date), 'MMM', { locale: ptBR })}</span>
                    <span className="text-xl font-black leading-none">{format(parseISO(event.date), 'dd')}</span>
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center gap-3">
                      <h3 className="font-black text-slate-900 text-lg">{event.name}</h3>
                      <Badge variant="accent">{event.type}</Badge>
                    </div>
                    <div className="flex items-center gap-4 text-sm font-bold text-slate-400">
                      <span className="flex items-center gap-1"><Clock size={14} /> {event.startTime}</span>
                      <span className="flex items-center gap-1"><Users size={14} /> {event.currentRegistrations} / {event.maxCapacity} inscritos</span>
                      {event.allowedGrades && event.allowedGrades.length > 0 && (
                        <span className="text-accent text-[10px] uppercase tracking-tighter">Restrito: {event.allowedGrades.join(', ')}</span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3 bg-slate-50 p-2 rounded-xl border border-slate-100">
                  <button 
                    onClick={() => { setSelectedEvent(event); fetchParticipants(event.id); setActiveTab('participants'); }}
                    className="flex items-center gap-2 px-4 py-2 text-slate-600 font-bold hover:text-primary transition-all text-sm"
                    title="Ver participantes"
                  >
                    <Users size={18} />
                    <span className="hidden sm:inline">Inscritos</span>
                  </button>
                  <div className="w-[1px] h-6 bg-slate-200"></div>
                  {deletingId === event.id ? (
                    <div className="flex items-center gap-2 animate-in fade-in slide-in-from-right-2">
                      <button 
                        onClick={() => handleDelete(event.id)}
                        className="px-3 py-1 bg-red-500 text-white text-xs font-bold rounded-lg hover:bg-red-600 transition-colors"
                      >
                        Confirmar
                      </button>
                      <button 
                        onClick={() => setDeletingId(null)}
                        className="px-3 py-1 bg-slate-200 text-slate-600 text-xs font-bold rounded-lg hover:bg-slate-300 transition-colors"
                      >
                        Cancelar
                      </button>
                    </div>
                  ) : (
                    <>
                      <button 
                        onClick={() => { setEditingEvent(event); setActiveTab('create'); }}
                        className="p-2 text-slate-400 hover:text-blue-600 transition-all"
                        title="Editar"
                      >
                        <Edit size={20} />
                      </button>
                      <button 
                        onClick={() => setDeletingId(event.id)}
                        className="p-2 text-slate-400 hover:text-red-500 transition-all"
                        title="Excluir"
                      >
                        <Trash2 size={20} />
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
            {events.length === 0 && (
              <div className="text-center py-20 bg-white rounded-3xl border-2 border-dashed border-slate-200">
                <p className="text-slate-400 font-bold">Nenhum evento cadastrado.</p>
              </div>
            )}
          </motion.div>
        )}

        {activeTab === 'create' && (
          <motion.div 
            key="create"
            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
          >
            <EventForm 
              initialData={editingEvent} 
              settings={localSettings}
              onSubmit={handleCreateOrUpdate} 
              onCancel={() => { setActiveTab('list'); setEditingEvent(null); }} 
            />
          </motion.div>
        )}

        {activeTab === 'stats' && (
          <motion.div 
            key="stats"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="grid grid-cols-1 md:grid-cols-3 gap-8"
          >
            <div className="card p-8 space-y-4">
              <div className="w-12 h-12 bg-blue-50 rounded-2xl flex items-center justify-center text-primary">
                <TrendingUp size={24} />
              </div>
              <div>
                <p className="text-slate-400 font-bold text-xs uppercase tracking-widest">Total de Eventos</p>
                <p className="text-4xl font-black text-slate-900">{events.length}</p>
              </div>
            </div>
            <div className="card p-8 space-y-4">
              <div className="w-12 h-12 bg-green-50 rounded-2xl flex items-center justify-center text-green-600">
                <Users size={24} />
              </div>
              <div>
                <p className="text-slate-400 font-bold text-xs uppercase tracking-widest">Total de Inscritos</p>
                <p className="text-4xl font-black text-slate-900">
                  {events.reduce((acc, e) => acc + e.currentRegistrations, 0)}
                </p>
              </div>
            </div>
            <div className="card p-8 space-y-4">
              <div className="w-12 h-12 bg-yellow-50 rounded-2xl flex items-center justify-center text-yellow-600">
                <PieChart size={24} />
              </div>
              <div>
                <p className="text-slate-400 font-bold text-xs uppercase tracking-widest">Ocupação Média</p>
                <p className="text-4xl font-black text-slate-900">
                  {events.length > 0 
                    ? Math.round((events.reduce((acc, e) => acc + (e.currentRegistrations / e.maxCapacity), 0) / events.length) * 100)
                    : 0}%
                </p>
              </div>
            </div>

            <div className="md:col-span-3 card p-8 space-y-6">
              <h3 className="font-black text-slate-900 text-xl">Eventos mais populares</h3>
              <div className="space-y-4">
                {[...events].sort((a, b) => b.currentRegistrations - a.currentRegistrations).slice(0, 5).map(event => (
                  <div key={event.id} className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-primary font-black shadow-sm">
                        {event.name.charAt(0)}
                      </div>
                      <div>
                        <p className="font-bold text-slate-900">{event.name}</p>
                        <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">{event.type}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-black text-slate-900">{event.currentRegistrations} / {event.maxCapacity}</p>
                      <div className="w-32 h-2 bg-slate-200 rounded-full mt-1 overflow-hidden">
                        <div 
                          className="h-full bg-accent" 
                          style={{ width: `${(event.currentRegistrations / event.maxCapacity) * 100}%` }}
                        ></div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        )}

        {activeTab === 'participants' && selectedEvent && (
          <motion.div 
            key="participants"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="space-y-8"
          >
            <div className="flex flex-col sm:flex-row justify-between items-center gap-6">
               <div className="flex items-center gap-4">
                 <button onClick={() => setActiveTab('list')} className="p-2 hover:bg-slate-100 rounded-lg transition-colors">
                   <ArrowLeft size={20} />
                 </button>
                 <div>
                   <h3 className="text-xl font-black text-slate-900">{selectedEvent.name}</h3>
                   <p className="text-slate-400 font-bold text-xs uppercase tracking-widest">{participants.length} participantes confirmados</p>
                 </div>
               </div>
               <div className="flex flex-wrap gap-3">
                <div className="relative mr-2">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                  <input 
                    type="text" 
                    placeholder="Filtrar inscritos..." 
                    className="input-field pl-10 py-2 text-sm bg-white border-slate-200 w-48 sm:w-64"
                    value={participantSearchTerm}
                    onChange={(e) => setParticipantSearchTerm(e.target.value)}
                  />
                </div>
                <button 
                  onClick={() => copyToClipboard(participants)}
                  className="flex items-center gap-2 px-4 py-2.5 bg-white border-2 border-slate-100 text-slate-600 rounded-xl font-bold hover:border-accent transition-all text-sm"
                >
                  <Copy size={16} />
                  Copiar
                </button>
                <button 
                  onClick={() => exportExcel(selectedEvent, participants)}
                  className="flex items-center gap-2 px-4 py-2.5 bg-green-50 text-green-700 rounded-xl font-bold hover:bg-green-100 transition-all text-sm"
                >
                  <Download size={16} />
                  Excel
                </button>
                <button 
                  onClick={() => exportPDF(selectedEvent, participants)}
                  className="flex items-center gap-2 px-4 py-2.5 bg-red-50 text-red-700 rounded-xl font-bold hover:bg-red-100 transition-all text-sm"
                >
                  <FileText size={16} />
                  PDF
                </button>
              </div>
            </div>

            <div className="card overflow-x-auto border-2 border-slate-100">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 border-b-2 border-slate-100">
                  <tr>
                    <th className="px-6 py-5 font-black text-slate-400 uppercase tracking-widest text-[10px]">Status</th>
                    <th className="px-6 py-5 font-black text-slate-400 uppercase tracking-widest text-[10px]">Data/Hora</th>
                    {participants.length > 0 && Object.keys(participants[0].formData).map(key => (
                      <th key={key} className="px-6 py-5 font-black text-slate-400 uppercase tracking-widest text-[10px]">{key.replace('_', ' ')}</th>
                    ))}
                    {selectedEvent.approvalMode === 'manual' && (
                      <th className="px-6 py-5 font-black text-slate-400 uppercase tracking-widest text-[10px]">Ações</th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {participants.filter(p => 
                    Object.values(p.formData).some(val => 
                      String(val).toLowerCase().includes(participantSearchTerm.toLowerCase())
                    )
                  ).map(p => (
                    <tr key={p.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4">
                        <Badge variant={p.status === 'approved' ? 'success' : 'warning'}>
                          {p.status === 'approved' ? 'Confirmado' : 'Pendente'}
                        </Badge>
                      </td>
                      <td className="px-6 py-4 text-slate-400 font-bold">{format(parseISO(p.createdAt), 'dd/MM HH:mm')}</td>
                      {Object.values(p.formData).map((val: any, i) => (
                        <td key={i} className="px-6 py-4 text-slate-900 font-bold">{val}</td>
                      ))}
                      {selectedEvent.approvalMode === 'manual' && (
                        <td className="px-6 py-4">
                          {p.status === 'pending' ? (
                            <button 
                              onClick={() => updateRegistrationStatus(p.id, 'approved')}
                              className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                              title="Aprovar"
                            >
                              <CheckCircle2 size={18} />
                            </button>
                          ) : (
                            <button 
                              onClick={() => updateRegistrationStatus(p.id, 'pending')}
                              className="p-2 text-yellow-600 hover:bg-yellow-50 rounded-lg transition-colors"
                              title="Mover para pendente"
                            >
                              <Clock size={18} />
                            </button>
                          )}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
              {participants.length === 0 && (
                <div className="text-center py-20">
                  <Users className="mx-auto text-slate-100 mb-4" size={64} />
                  <p className="text-slate-400 font-bold">Nenhuma inscrição realizada ainda.</p>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function EventForm({ initialData, settings, onSubmit, onCancel }: { initialData: Event | null, settings: AppSettings, onSubmit: (data: any) => void, onCancel: () => void }) {
  const [formData, setFormData] = useState<any>(initialData ? {
    ...initialData,
    configFields: initialData.configFields ? JSON.parse(initialData.configFields) : {}
  } : {
    name: '',
    description: '',
    type: settings.eventTypes[0] || 'Oficina',
    date: format(new Date(), 'yyyy-MM-dd'),
    startTime: '08:00',
    duration: '1h',
    maxCapacity: 30,
    location: '',
    approvalMode: 'automatic',
    targetAudience: 'alunos',
    allowedGrades: [],
    configFields: {
      studentName: true,
      studentSurname: true,
      studentGrade: true,
      studentClass: true,
      studentEmail: false,
      studentPhone: false,
      studentCpf: false,
      parentName: false,
      parentPhone: false,
      parentEmail: false,
      parentCpf: false,
      parentStudentName: false,
      parentStudentGrade: false,
      parentStudentClass: false,
    }
  });

  const toggleGrade = (grade: string) => {
    setFormData((prev: any) => {
      const current = prev.allowedGrades || [];
      const updated = current.includes(grade)
        ? current.filter((g: string) => g !== grade)
        : [...current, grade];
      return { ...prev, allowedGrades: updated };
    });
  };

  const toggleField = (field: keyof EventConfigFields) => {
    setFormData((prev: any) => ({
      ...prev,
      configFields: {
        ...prev.configFields,
        [field]: !prev.configFields[field]
      }
    }));
  };

  return (
    <form onSubmit={(e) => { e.preventDefault(); onSubmit({ ...formData, configFields: JSON.stringify(formData.configFields) }); }} className="card p-10 space-y-10 border-t-8 border-accent">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
        <div className="space-y-8">
          <h3 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-3">
            Informações do Evento
            <div className="h-[2px] flex-1 bg-slate-100"></div>
          </h3>
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-700">Nome do Evento</label>
              <input required type="text" className="input-field py-3" value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-700">Descrição</label>
              <textarea required className="input-field min-h-[120px] py-3" value={formData.description} onChange={(e) => setFormData({...formData, description: e.target.value})} />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-700">Local (Opcional)</label>
              <input type="text" className="input-field py-3" value={formData.location} onChange={(e) => setFormData({...formData, location: e.target.value})} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-bold text-slate-700">Tipo</label>
                <select className="input-field py-3" value={formData.type} onChange={(e) => setFormData({...formData, type: e.target.value})}>
                  {settings.eventTypes.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-bold text-slate-700">Público</label>
                <select className="input-field py-3" value={formData.targetAudience} onChange={(e) => setFormData({...formData, targetAudience: e.target.value})}>
                  <option value="alunos">Alunos</option>
                  <option value="responsaveis">Responsáveis</option>
                  <option value="ambos">Ambos</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-8">
          <h3 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-3">
            Logística e Formulário
            <div className="h-[2px] flex-1 bg-slate-100"></div>
          </h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-700">Data</label>
              <input required type="date" className="input-field py-3" value={formData.date} onChange={(e) => setFormData({...formData, date: e.target.value})} />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-700">Início</label>
              <input required type="time" className="input-field py-3" value={formData.startTime} onChange={(e) => setFormData({...formData, startTime: e.target.value})} />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-700">Duração</label>
              <input required type="text" placeholder="ex: 1h 30min" className="input-field py-3" value={formData.duration} onChange={(e) => setFormData({...formData, duration: e.target.value})} />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-700">Vagas</label>
              <input required type="number" className="input-field py-3" value={formData.maxCapacity} onChange={(e) => setFormData({...formData, maxCapacity: parseInt(e.target.value)})} />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-700">Modo de Inscrição</label>
              <select className="input-field py-3" value={formData.approvalMode} onChange={(e) => setFormData({...formData, approvalMode: e.target.value})}>
                <option value="automatic">Automática</option>
                <option value="manual">Com Aprovação Manual</option>
              </select>
            </div>
          </div>

          <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100 space-y-6">
            <div className="space-y-4">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Campos da Inscrição (Aluno)</p>
              <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                {[
                  { id: 'studentName', label: 'Nome' },
                  { id: 'studentSurname', label: 'Sobrenome' },
                  { id: 'studentGrade', label: 'Série' },
                  { id: 'studentClass', label: 'Turma' },
                  { id: 'studentEmail', label: 'Email' },
                  { id: 'studentPhone', label: 'Telefone' },
                  { id: 'studentCpf', label: 'CPF/RG' },
                ].map((field) => (
                  <label key={field.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-white cursor-pointer transition-colors">
                    <input 
                      type="checkbox" 
                      className="w-4 h-4 rounded border-slate-300 text-accent focus:ring-accent"
                      checked={formData.configFields[field.id as keyof EventConfigFields]} 
                      onChange={() => toggleField(field.id as keyof EventConfigFields)} 
                    />
                    <span className="text-xs font-bold text-slate-600">{field.label}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="space-y-4 pt-4 border-t border-slate-200">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Campos da Inscrição (Responsável)</p>
              <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                {[
                  { id: 'parentName', label: 'Nome Responsável' },
                  { id: 'parentPhone', label: 'Telefone' },
                  { id: 'parentEmail', label: 'Email' },
                  { id: 'parentCpf', label: 'CPF/RG' },
                  { id: 'parentStudentName', label: 'Nome do Aluno' },
                  { id: 'parentStudentGrade', label: 'Série do Aluno' },
                  { id: 'parentStudentClass', label: 'Turma do Aluno' },
                ].map((field) => (
                  <label key={field.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-white cursor-pointer transition-colors">
                    <input 
                      type="checkbox" 
                      className="w-4 h-4 rounded border-slate-300 text-accent focus:ring-accent"
                      checked={formData.configFields[field.id as keyof EventConfigFields]} 
                      onChange={() => toggleField(field.id as keyof EventConfigFields)} 
                    />
                    <span className="text-xs font-bold text-slate-600">{field.label}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>

          <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100 space-y-4">
            <div className="flex justify-between items-center">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Restrição de Séries</p>
              <span className="text-[9px] font-bold text-slate-400 italic">Vazio = Todas as séries permitidas</span>
            </div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-2">
              {settings.grades.map((grade) => (
                <label key={grade} className="flex items-center gap-3 p-2 rounded-lg hover:bg-white cursor-pointer transition-colors">
                  <input 
                    type="checkbox" 
                    className="w-4 h-4 rounded border-slate-300 text-accent focus:ring-accent"
                    checked={formData.allowedGrades?.includes(grade)} 
                    onChange={() => toggleGrade(grade)} 
                  />
                  <span className="text-xs font-bold text-slate-600">{grade}</span>
                </label>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-4 pt-10 border-t-2 border-slate-100">
        <button type="button" onClick={onCancel} className="flex-1 px-8 py-4 border-2 border-slate-100 rounded-2xl text-slate-500 font-bold hover:bg-slate-50 transition-colors">
          Descartar
        </button>
        <button type="submit" className="flex-1 btn-accent py-4 text-lg rounded-2xl">
          {initialData ? 'Salvar Alterações' : 'Publicar Evento'}
        </button>
      </div>
    </form>
  );
}
