import React, { useState, useEffect } from 'react';
import { 
  Calendar, 
  Plus, 
  Users, 
  Trash2, 
  ChevronRight, 
  CheckCircle2, 
  AlertCircle, 
  Clock, 
  ArrowLeft,
  Download,
  Search,
  Settings,
  X,
  PlusCircle,
  GripVertical,
  Copy,
  Printer,
  Edit,
  Lock as LockIcon
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

// --- Types ---

interface EventField {
  id?: number;
  field_name: string;
  field_label: string;
  field_type: 'text' | 'select' | 'radio' | 'textarea';
  is_required: boolean;
  options?: string; // Comma separated
}

interface Event {
  id: number;
  name: string;
  type: string; // fallback or legacy
  description: string;
  date: string;
  time: string;
  max_vagas: number;
  deadline: string;
  classes_allowed: string;
  years_allowed: string;
  status: string;
  current_registrations: number;
  category_id?: number;
  subcategory_id?: number;
  category_name?: string;
  subcategory_name?: string;
  is_paid?: number;
  restringir_duplicidade?: number;
  limitar_vagas_por_ano?: number;
  vagas_por_ano?: number;
  fields?: EventField[];
}

interface Registration {
  id: number;
  event_id: number;
  registration_date: string;
  data: Record<string, any>;
}

interface Student {
  id: number;
  name: string;
  grade: string;
  created_at?: string;
}

interface Subcategory {
  id: number;
  category_id: number;
  name: string;
}

interface Category {
  id: number;
  name: string;
  subcategories: Subcategory[];
}

// --- Components ---

const Badge = ({ children, variant = 'default' }: { children: React.ReactNode, variant?: 'default' | 'success' | 'danger' | 'warning' }) => {
  const styles = {
    default: 'bg-slate-100 text-slate-700',
    success: 'bg-emerald-100 text-emerald-700',
    danger: 'bg-rose-100 text-rose-700',
    warning: 'bg-amber-100 text-amber-700',
  };
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${styles[variant]}`}>
      {children}
    </span>
  );
};
const formatYears = (yearsString: string | undefined) => {
  if (!yearsString || !yearsString.trim()) return "Livre para todos os públicos";
  
  const years = yearsString.split(',').map(y => y.trim());
  const allPossibleYears = ['6° Ano', '7° Ano', '8° Ano', '9° Ano', '1° Ano EM', '2° Ano EM', '3° Ano EM'];
  
  const allSelected = allPossibleYears.every(y => years.includes(y));
  if (allSelected) return "Livre para todos os públicos";
  
  const fund2 = ['6° Ano', '7° Ano', '8° Ano', '9° Ano'];
  const hasOnlyFund2 = fund2.every(y => years.includes(y)) && years.every(y => fund2.includes(y));
  
  const em = ['1° Ano EM', '2° Ano EM', '3° Ano EM'];
  const hasOnlyEM = em.every(y => years.includes(y)) && years.every(y => em.includes(y));

  if (hasOnlyFund2) return "Ensino Fundamental 2";
  if (hasOnlyEM) return "Ensino Médio";
  
  if (years.length === 1) {
    return `Somente ${years[0]}`;
  }
  
  if (years.length === 2) {
    return `${years[0]} e ${years[1]}`;
  }
  
  return years.slice(0, -1).join(', ') + ' e ' + years[years.length - 1];
};

export default function App() {
  const [view, setView] = useState<'user' | 'admin'>('user');
  const [events, setEvents] = useState<Event[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);
  const [isViewingRegs, setIsViewingRegs] = useState(false);
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [regFields, setRegFields] = useState<EventField[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState(false);
  const [editingEventId, setEditingEventId] = useState<number | null>(null);

  // New States for Students & Categories
  const [students, setStudents] = useState<Student[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [adminTab, setAdminTab] = useState<'events' | 'students' | 'categories'>('events');
  const [studentSearch, setStudentSearch] = useState('');
  const [studentGradeFilter, setStudentGradeFilter] = useState('');

  // Autocomplete and warning states
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [registrationError, setRegistrationError] = useState<string | null>(null);
  const [paidChecked, setPaidChecked] = useState(false);

  // Modal states for admin management
  const [showAddStudentModal, setShowAddStudentModal] = useState(false);
  const [newStudentName, setNewStudentName] = useState('');
  const [newStudentGrade, setNewStudentGrade] = useState('6° Ano');

  const [showPasteStudentsModal, setShowPasteStudentsModal] = useState(false);
  const [pasteStudentGrade, setPasteStudentGrade] = useState('6° Ano');
  const [pasteStudentNamesText, setPasteStudentNamesText] = useState('');

  const [showAddCategoryModal, setShowAddCategoryModal] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');

  const [newSubcategoryName, setNewSubcategoryName] = useState<Record<number, string>>({});

  const checkEligibility = (grade: string) => {
    if (selectedEvent && selectedEvent.years_allowed && selectedEvent.years_allowed.trim()) {
      const allowed = selectedEvent.years_allowed.split(',').map(y => y.trim().toLowerCase());
      if (!allowed.includes(grade.toLowerCase())) {
        setRegistrationError(`Atenção: O ano escolar "${grade}" não é permitido para este evento.`);
        return false;
      }
    }
    setRegistrationError(null);
    return true;
  };

  const onSelectStudent = (s: Student) => {
    const parts = s.name.trim().split(' ');
    const firstName = parts[0];
    const lastName = parts.slice(1).join(' ');
    
    setRegData(prev => ({
      ...prev,
      nome: firstName,
      sobrenome: lastName,
      ano_escolar: s.grade
    }));
    
    checkEligibility(s.grade);
    setShowSuggestions(false);
  };

  const startRegistration = async (event: Event) => {
    const details = await fetchEventDetails(event.id);
    setSelectedEvent(details);
    setRegData({
      nome: '',
      sobrenome: '',
      ano_escolar: '',
      turma_letra: ''
    });
    setRegistrationError(null);
    setPaidChecked(false);
    setShowSuggestions(false);
    setIsRegistering(true);
  };

  // Form States
  const [newEvent, setNewEvent] = useState<Partial<Event>>({
    name: '',
    type: 'Oficina',
    description: '',
    date: '',
    time: '',
    max_vagas: 30,
    deadline: '',
    classes_allowed: '',
    years_allowed: '',
    category_id: undefined,
    subcategory_id: undefined,
    is_paid: 0,
    restringir_duplicidade: 0,
    limitar_vagas_por_ano: 0,
    vagas_por_ano: undefined,
    fields: [
      { field_name: 'nome', field_label: 'Nome', field_type: 'text', is_required: true },
      { field_name: 'sobrenome', field_label: 'Sobrenome', field_type: 'text', is_required: true },
      { 
        field_name: 'ano_escolar', 
        field_label: 'Ano Escolar', 
        field_type: 'select', 
        is_required: true, 
        options: '6° Ano, 7° Ano, 8° Ano, 9° Ano, 1° Ano EM, 2° Ano EM, 3° Ano EM' 
      },
      { 
        field_name: 'turma_letra', 
        field_label: 'Letra da Turma', 
        field_type: 'select', 
        is_required: true, 
        options: 'A, B, C, D, E' 
      }
    ]
  });

  const [regData, setRegData] = useState<Record<string, any>>({});

  useEffect(() => {
    fetchEvents();
    fetchStudents();
    fetchCategories();
  }, []);

  const fetchEvents = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/events');
      const data = await res.json();
      setEvents(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchStudents = async () => {
    try {
      const res = await fetch('/api/students');
      const data = await res.json();
      setStudents(data);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchCategories = async () => {
    try {
      const res = await fetch('/api/categories');
      const data = await res.json();
      setCategories(data);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchEventDetails = async (id: number) => {
    try {
      const res = await fetch(`/api/events/${id}`);
      const data = await res.json();
      setSelectedEvent(data);
      return data;
    } catch (err) {
      console.error(err);
    }
  };

  const fetchRegistrations = async (id: number) => {
    try {
      const res = await fetch(`/api/events/${id}/registrations`);
      const data = await res.json();
      setRegistrations(data.registrations);
      setRegFields(data.fields);
    } catch (err) {
      console.error(err);
    }
  };

  const handleAddStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStudentName.trim()) return;
    try {
      const res = await fetch('/api/students', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newStudentName.trim(), grade: newStudentGrade })
      });
      if (res.ok) {
        setNewStudentName('');
        setShowAddStudentModal(false);
        fetchStudents();
      } else {
        const err = await res.json();
        alert(err.error || 'Erro ao adicionar aluno.');
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handlePasteStudents = async (e: React.FormEvent) => {
    e.preventDefault();
    const names = pasteStudentNamesText.split('\n').map(n => n.trim()).filter(Boolean);
    if (names.length === 0) return;
    try {
      const res = await fetch('/api/students/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ grade: pasteStudentGrade, names })
      });
      if (res.ok) {
        setPasteStudentNamesText('');
        setShowPasteStudentsModal(false);
        fetchStudents();
      } else {
        const err = await res.json();
        alert(err.error || 'Erro ao adicionar alunos.');
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteStudent = async (id: number) => {
    if (!confirm('Deseja realmente remover este aluno?')) return;
    try {
      const res = await fetch(`/api/students/${id}`, { method: 'DELETE' });
      if (res.ok) {
        fetchStudents();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteRegistration = async (id: number) => {
    if (!confirm('Deseja realmente remover esta inscrição?')) return;
    try {
      const res = await fetch(`/api/registrations/${id}`, { method: 'DELETE' });
      if (res.ok && selectedEvent) {
        fetchRegistrations(selectedEvent.id);
        fetchEvents(); // update counts
      }
    } catch (err) {
      console.error(err);
    }
  };


  const handleAddCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCategoryName.trim()) return;
    try {
      const res = await fetch('/api/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newCategoryName.trim() })
      });
      if (res.ok) {
        setNewCategoryName('');
        setShowAddCategoryModal(false);
        fetchCategories();
      } else {
        const err = await res.json();
        alert(err.error || 'Erro ao adicionar categoria.');
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteCategory = async (id: number) => {
    if (!confirm('Deseja realmente remover esta categoria? Isso removerá todas as subcategorias vinculadas.')) return;
    try {
      const res = await fetch(`/api/categories/${id}`, { method: 'DELETE' });
      if (res.ok) {
        fetchCategories();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleAddSubcategory = async (categoryId: number) => {
    const name = newSubcategoryName[categoryId];
    if (!name || !name.trim()) return;
    try {
      const res = await fetch(`/api/categories/${categoryId}/subcategories`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim() })
      });
      if (res.ok) {
        setNewSubcategoryName(prev => ({ ...prev, [categoryId]: '' }));
        fetchCategories();
      } else {
        const err = await res.json();
        alert(err.error || 'Erro ao adicionar tipo.');
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteSubcategory = async (id: number) => {
    if (!confirm('Deseja realmente remover este tipo?')) return;
    try {
      const res = await fetch(`/api/subcategories/${id}`, { method: 'DELETE' });
      if (res.ok) {
        fetchCategories();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const exportStudentsToCSV = () => {
    const filtered = students.filter(s => {
      const matchSearch = s.name.toLowerCase().includes(studentSearch.toLowerCase());
      const matchGrade = !studentGradeFilter || s.grade === studentGradeFilter;
      return matchSearch && matchGrade;
    });

    if (filtered.length === 0) return;
    
    const headers = ['Nome', 'Ano Escolar'];
    const rows = filtered.map(s => [s.name, s.grade]);
    
    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');
    
    const blob = new Blob([`\uFEFF${csvContent}`], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `alunos_cadastrados.csv`;
    link.click();
  };

  const resetNewEvent = () => {
    setNewEvent({
      name: '',
      type: 'Oficina',
      description: '',
      date: '',
      time: '',
      max_vagas: 30,
      deadline: '',
      classes_allowed: '',
      years_allowed: '',
      category_id: undefined,
      subcategory_id: undefined,
      is_paid: 0,
      restringir_duplicidade: 0,
      limitar_vagas_por_ano: 0,
      vagas_por_ano: undefined,
      fields: [
        { field_name: 'nome', field_label: 'Nome', field_type: 'text', is_required: true },
        { field_name: 'sobrenome', field_label: 'Sobrenome', field_type: 'text', is_required: true },
        { 
          field_name: 'ano_escolar', 
          field_label: 'Ano Escolar', 
          field_type: 'select', 
          is_required: true, 
          options: '6° Ano, 7° Ano, 8° Ano, 9° Ano, 1° Ano EM, 2° Ano EM, 3° Ano EM' 
        },
        { 
          field_name: 'turma_letra', 
          field_label: 'Letra da Turma', 
          field_type: 'select', 
          is_required: true, 
          options: 'A, B, C, D, E' 
        }
      ]
    });
    setEditingEventId(null);
  };

  const handleSubmitEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    const url = editingEventId ? `/api/events/${editingEventId}` : '/api/events';
    const method = editingEventId ? 'PUT' : 'POST';
    
    try {
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newEvent)
      });
      if (res.ok) {
        setIsCreating(false);
        fetchEvents();
        resetNewEvent();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleEditEvent = async (event: Event) => {
    const details = await fetchEventDetails(event.id);
    if (details) {
      setNewEvent({
        ...details,
        // Ensure date and deadline are correctly formatted for inputs if needed
        // but since we store them as strings from inputs, they should match
      });
      setEditingEventId(event.id);
      setIsCreating(true);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEvent) return;
    try {
      const res = await fetch(`/api/events/${selectedEvent.id}/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: regData })
      });
      if (res.ok) {
        alert('Inscrição realizada com sucesso!');
        setIsRegistering(false);
        setRegData({});
        fetchEvents();
      } else {
        const err = await res.json();
        alert(err.error || 'Erro ao realizar inscrição');
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteEvent = async (id: number) => {
    if (!confirm('Tem certeza que deseja excluir este evento?')) return;
    try {
      await fetch(`/api/events/${id}`, { method: 'DELETE' });
      fetchEvents();
    } catch (err) {
      console.error(err);
    }
  };

  const addField = () => {
    setNewEvent({
      ...newEvent,
      fields: [
        ...(newEvent.fields || []),
        { field_name: `campo_${Date.now()}`, field_label: 'Novo Campo', field_type: 'text', is_required: false }
      ]
    });
  };

  const removeField = (index: number) => {
    const fields = [...(newEvent.fields || [])];
    fields.splice(index, 1);
    setNewEvent({ ...newEvent, fields });
  };

  const updateField = (index: number, updates: Partial<EventField>) => {
    const fields = [...(newEvent.fields || [])];
    fields[index] = { ...fields[index], ...updates };
    setNewEvent({ ...newEvent, fields });
  };

  const isEventFull = (event: Event) => event.current_registrations >= event.max_vagas;
  const isDeadlinePassed = (event: Event) => new Date() > new Date(event.deadline);

  const exportToCSV = () => {
    if (!selectedEvent || registrations.length === 0) return;
    
    const headers = ['Data Inscrição', ...regFields.map(f => f.field_label)];
    const rows = registrations.map(r => [
      new Date(r.registration_date).toLocaleString(),
      ...regFields.map(f => r.data[f.field_name] || '')
    ]);
    
    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `inscricoes_${selectedEvent.name.replace(/\s+/g, '_')}.csv`;
    link.click();
  };

  const copyToClipboard = () => {
    if (!selectedEvent || registrations.length === 0) return;
    
    const headers = ['Data Inscrição', ...regFields.map(f => f.field_label)];
    const rows = registrations.map(r => [
      new Date(r.registration_date).toLocaleString(),
      ...regFields.map(f => r.data[f.field_name] || '')
    ]);
    
    const text = [
      headers.join('\t'),
      ...rows.map(row => row.join('\t'))
    ].join('\n');
    
    navigator.clipboard.writeText(text);
    alert('Lista copiada para a área de transferência!');
  };

  const printList = () => {
    window.print();
  };

  const [showPinModal, setShowPinModal] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('admin') === 'true') {
      setShowPinModal(true);
      // Limpar a URL
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  const handlePinSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setPinError(false);
    
    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: pinInput })
      });
      
      const data = await res.json();
      
      if (data.authorized) {
        setIsAdminAuthenticated(true);
        setView('admin');
        setShowPinModal(false);
        setPinInput('');
      } else {
        setPinError(true);
        setPinInput('');
        setTimeout(() => setPinError(false), 500);
      }
    } catch (err) {
      console.error('Erro no login:', err);
      setPinError(true);
      setPinInput('');
      setTimeout(() => setPinError(false), 500);
    }
  };

  const handleSwitchToAdmin = () => {
    if (isAdminAuthenticated) {
      setView('admin');
    } else {
      setShowPinModal(true);
    }
  };

  const handleSwitchToUser = () => {
    setView('user');
    setIsCreating(false);
    setIsViewingRegs(false);
    setIsRegistering(false);
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] font-sans text-slate-900">
      {/* Header */}
      <header className="bg-[#004a99] text-white shadow-lg sticky top-0 z-50 no-print">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-[#fff200] p-2 rounded-lg">
              <Calendar className="w-6 h-6 text-[#004a99]" />
            </div>
            <div>
              <h1 className="text-lg font-bold leading-tight">SESI Internacional</h1>
              <p className="text-[10px] uppercase tracking-widest opacity-80">Portal de Eventos</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2 bg-white/10 p-1 rounded-full">
            <button 
              onClick={handleSwitchToUser}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all ${view === 'user' ? 'bg-[#fff200] text-[#004a99]' : 'hover:bg-white/10'}`}
            >
              Eventos
            </button>
            <button 
              onClick={handleSwitchToAdmin}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all ${view === 'admin' ? 'bg-[#fff200] text-[#004a99]' : 'hover:bg-white/10'}`}
            >
              Painel Admin
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* User View */}
        {view === 'user' && !isRegistering && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h2 className="text-2xl font-bold text-slate-800">Próximos Eventos</h2>
                <p className="text-slate-500">Confira as atividades disponíveis e garanta sua vaga.</p>
              </div>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input 
                  type="text" 
                  placeholder="Buscar eventos..."
                  className="pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl w-full md:w-64 focus:ring-2 focus:ring-[#004a99] focus:border-transparent outline-none"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>

            {loading ? (
              <div className="flex justify-center py-20">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#004a99]"></div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {events
                  .filter(e => {
                    const matchesSearch = e.name.toLowerCase().includes(searchTerm.toLowerCase());
                    const hasSpots = !isEventFull(e);
                    const isWithinDeadline = !isDeadlinePassed(e);
                    return matchesSearch && hasSpots && isWithinDeadline;
                  })
                  .map(event => {
                    const full = isEventFull(event);
                    const closed = isDeadlinePassed(event);
                    return (
                      <motion.div 
                        key={event.id}
                        whileHover={{ y: -4 }}
                        className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col"
                      >
                        <div className="p-6 flex-1">
                          <div className="flex justify-between items-start mb-4">
                            <Badge variant={event.type === 'Oficina' ? 'warning' : 'default'}>
                              {event.category_name ? `${event.category_name}${event.subcategory_name ? ` · ${event.subcategory_name}` : ''}` : event.type}
                            </Badge>
                            <div className="flex gap-1.5">
                              {event.is_paid === 1 ? (
                                <Badge variant="danger">Pago</Badge>
                              ) : (
                                <Badge variant="success">Gratuito</Badge>
                              )}
                              {full && <Badge variant="danger">LOTADO</Badge>}
                              {!full && closed && <Badge variant="danger">ENCERRADO</Badge>}
                            </div>
                          </div>
                          <h3 className="text-xl font-bold mb-2 text-slate-800">{event.name}</h3>
                          <p className="text-slate-500 text-sm line-clamp-2 mb-4">{event.description}</p>
                          
                          <div className="space-y-2 text-sm text-slate-600">
                            <div className="flex items-center gap-2">
                              <Calendar className="w-4 h-4 text-[#004a99]" />
                              <span>{new Date(event.date).toLocaleDateString('pt-BR')}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <Clock className="w-4 h-4 text-[#004a99]" />
                              <span>{event.time}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <Users className="w-4 h-4 text-[#004a99]" />
                              <span>{event.max_vagas - event.current_registrations} vagas restantes</span>
                            </div>
                            <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 mt-2 bg-slate-50 p-2 rounded-lg border border-slate-100">
                              <AlertCircle className="w-3.5 h-3.5 text-[#004a99]" />
                              <span>Público: {formatYears(event.years_allowed)}</span>
                            </div>
                          </div>
                        </div>
                        <div className="p-4 bg-slate-50 border-t border-slate-100">
                          <button 
                            disabled={full || closed}
                            onClick={() => startRegistration(event)}
                            className={`w-full py-2.5 rounded-xl font-bold transition-all flex items-center justify-center gap-2 ${full || closed ? 'bg-slate-200 text-slate-400 cursor-not-allowed' : 'bg-[#fff200] text-[#004a99] hover:bg-[#ffe600] shadow-sm'}`}
                          >
                            {full ? 'Vagas Esgotadas' : closed ? 'Inscrições Encerradas' : 'Inscrever-se'}
                            {!full && !closed && <ChevronRight className="w-4 h-4" />}
                          </button>
                        </div>
                      </motion.div>
                    );
                  })}
              </div>
            )}
          </motion.div>
        )}

        {/* Registration Form */}
        {isRegistering && selectedEvent && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="max-w-2xl mx-auto bg-white sm:rounded-3xl shadow-xl border-x border-b sm:border border-slate-200 overflow-hidden"
          >
            <div className="bg-[#004a99] p-6 sm:p-8 text-white relative">
              <button 
                onClick={() => setIsRegistering(false)}
                className="absolute top-4 right-4 sm:top-6 sm:right-6 p-2 hover:bg-white/10 rounded-full transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
              <h2 className="text-2xl sm:text-3xl font-bold mb-2">Inscrição</h2>
              <p className="opacity-80 text-sm sm:text-base">{selectedEvent.name}</p>
            </div>
            
            <form onSubmit={handleRegister} className="p-6 sm:p-8 space-y-6">
              {/* Avisos Importantes */}
              <div className="space-y-3">
                {selectedEvent.years_allowed && selectedEvent.years_allowed.trim() !== '' && (
                  <div className="bg-blue-50 border border-blue-200 text-[#004a99] p-4 rounded-xl flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                    <div>
                      <h4 className="font-bold text-sm">Restrição de Ano Escolar</h4>
                      <p className="text-xs mt-0.5">Este evento é exclusivo para alunos do: <strong>{formatYears(selectedEvent.years_allowed)}</strong>.</p>
                    </div>
                  </div>
                )}

                {selectedEvent.is_paid === 1 && (
                  <div className="bg-amber-50 border border-amber-200 text-amber-800 p-4 rounded-xl flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 shrink-0 mt-0.5 text-amber-600" />
                    <div>
                      <h4 className="font-bold text-sm text-amber-900">Atividade Paga</h4>
                      <p className="text-xs mt-0.5">Esta atividade é paga. Ao se inscrever, você precisará confirmar a ciência do valor associado.</p>
                    </div>
                  </div>
                )}

                {selectedEvent.limitar_vagas_por_ano === 1 && selectedEvent.vagas_por_ano !== undefined && (
                  <div className="bg-blue-50 border border-blue-200 text-[#004a99] p-4 rounded-xl flex items-start gap-3">
                    <Users className="w-5 h-5 shrink-0 mt-0.5 text-[#004a99]" />
                    <div>
                      <h4 className="font-bold text-sm">Limite de Vagas por Ano</h4>
                      <p className="text-xs mt-0.5">Há um limite de <strong>{selectedEvent.vagas_por_ano} vagas</strong> para estudantes de cada ano escolar individualmente.</p>
                    </div>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 gap-6">
                {selectedEvent.fields?.map((field) => (
                  <div key={field.id} className="space-y-2">
                    <label className="text-sm font-semibold text-slate-700 flex items-center gap-1">
                      {field.field_label}
                      {field.is_required && <span className="text-rose-500">*</span>}
                    </label>
                    
                    {field.field_name === 'nome' ? (
                      <div className="relative">
                        <input 
                          type="text"
                          required={field.is_required}
                          value={regData.nome || ''}
                          className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#004a99] outline-none transition-all"
                          placeholder="Comece a digitar para pesquisar..."
                          onChange={(e) => {
                            const val = e.target.value;
                            setRegData({ ...regData, nome: val });
                            setShowSuggestions(val.trim().length > 1);
                          }}
                          onFocus={() => {
                            if ((regData.nome || '').trim().length > 1) {
                              setShowSuggestions(true);
                            }
                          }}
                        />
                        {showSuggestions && students.filter(s => s.name.toLowerCase().includes((regData.nome || '').toLowerCase())).length > 0 && (
                          <div className="absolute left-0 right-0 mt-1 max-h-48 overflow-y-auto bg-white border border-slate-200 rounded-xl shadow-xl z-50 divide-y divide-slate-100">
                            {students
                              .filter(s => s.name.toLowerCase().includes((regData.nome || '').toLowerCase()))
                              .map(s => (
                                <button
                                  key={s.id}
                                  type="button"
                                  onClick={() => onSelectStudent(s)}
                                  className="w-full px-4 py-3 text-left hover:bg-slate-50 text-sm font-medium flex justify-between items-center transition-colors"
                                >
                                  <span className="text-slate-800">{s.name}</span>
                                  <span className="text-xs text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">{s.grade}</span>
                                </button>
                              ))}
                          </div>
                        )}
                      </div>
                    ) : field.field_name === 'sobrenome' ? (
                      <input 
                        type="text"
                        required={field.is_required}
                        value={regData.sobrenome || ''}
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#004a99] outline-none transition-all"
                        onChange={(e) => setRegData({ ...regData, sobrenome: e.target.value })}
                      />
                    ) : field.field_name === 'ano_escolar' ? (
                      <select 
                        required={field.is_required}
                        value={regData.ano_escolar || ''}
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#004a99] outline-none transition-all"
                        onChange={(e) => {
                          const val = e.target.value;
                          setRegData({ ...regData, ano_escolar: val });
                          checkEligibility(val);
                        }}
                      >
                        <option value="">Selecione...</option>
                        {field.options?.split(',').map(opt => (
                          <option key={opt} value={opt.trim()}>{opt.trim()}</option>
                        ))}
                      </select>
                    ) : field.field_name === 'turma_letra' ? (
                      <select 
                        required={field.is_required}
                        value={regData.turma_letra || ''}
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#004a99] outline-none transition-all"
                        onChange={(e) => setRegData({ ...regData, turma_letra: e.target.value })}
                      >
                        <option value="">Selecione...</option>
                        {field.options?.split(',').map(opt => (
                          <option key={opt} value={opt.trim()}>{opt.trim()}</option>
                        ))}
                      </select>
                    ) : field.field_type === 'text' ? (
                      <input 
                        type="text"
                        required={field.is_required}
                        value={regData[field.field_name] || ''}
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#004a99] outline-none transition-all"
                        onChange={(e) => setRegData({ ...regData, [field.field_name]: e.target.value })}
                      />
                    ) : field.field_type === 'textarea' ? (
                      <textarea 
                        required={field.is_required}
                        rows={3}
                        value={regData[field.field_name] || ''}
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#004a99] outline-none transition-all"
                        onChange={(e) => setRegData({ ...regData, [field.field_name]: e.target.value })}
                      />
                    ) : field.field_type === 'select' ? (
                      <select 
                        required={field.is_required}
                        value={regData[field.field_name] || ''}
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#004a99] outline-none transition-all"
                        onChange={(e) => setRegData({ ...regData, [field.field_name]: e.target.value })}
                      >
                        <option value="">Selecione...</option>
                        {field.options?.split(',').map(opt => (
                          <option key={opt} value={opt.trim()}>{opt.trim()}</option>
                        ))}
                      </select>
                    ) : field.field_type === 'radio' ? (
                      <div className="flex flex-wrap gap-4 pt-2">
                        {field.options?.split(',').map(opt => (
                          <label key={opt} className="flex items-center gap-2 cursor-pointer">
                            <input 
                              type="radio" 
                              name={field.field_name}
                              required={field.is_required}
                              checked={regData[field.field_name] === opt.trim()}
                              value={opt.trim()}
                              className="w-4 h-4 text-[#004a99] focus:ring-[#004a99]"
                              onChange={(e) => setRegData({ ...regData, [field.field_name]: e.target.value })}
                            />
                            <span className="text-sm text-slate-600">{opt.trim()}</span>
                          </label>
                        ))}
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>

              {/* Checkbox de Confirmação de Evento Pago e Erros de Validação */}
              <div className="pt-4 space-y-4">
                {selectedEvent.is_paid === 1 && (
                  <label className="flex items-start gap-3 cursor-pointer p-4 bg-amber-50/50 border border-amber-200 rounded-2xl hover:bg-amber-50 transition-all select-none">
                    <input 
                      type="checkbox" 
                      required
                      checked={paidChecked}
                      onChange={(e) => setPaidChecked(e.target.checked)}
                      className="w-5 h-5 mt-0.5 text-amber-600 border-amber-300 rounded focus:ring-amber-500"
                    />
                    <span className="text-sm font-semibold text-amber-900">
                      Estou ciente de que esta atividade é paga e confirmo minha concordância com os custos adicionais.
                    </span>
                  </label>
                )}

                {registrationError && (
                  <div className="bg-rose-50 border border-rose-200 text-rose-800 p-4 rounded-xl flex items-center gap-3">
                    <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
                    <span className="text-sm font-bold">{registrationError}</span>
                  </div>
                )}

                <button 
                  type="submit"
                  disabled={!!registrationError || (selectedEvent.is_paid === 1 && !paidChecked)}
                  className={`w-full py-4 rounded-2xl font-black text-lg shadow-lg transition-all active:scale-95 ${
                    !!registrationError || (selectedEvent.is_paid === 1 && !paidChecked)
                      ? 'bg-slate-200 text-slate-400 cursor-not-allowed shadow-none'
                      : 'bg-[#fff200] text-[#004a99] hover:bg-[#ffe600] shadow-yellow-200'
                  }`}
                >
                  Confirmar Inscrição
                </button>
                <p className="text-center text-xs text-slate-400 mt-2">
                  Ao clicar em confirmar, você concorda com as diretrizes do portal de eventos.
                </p>
              </div>
            </form>
          </motion.div>
        )}

        {/* Admin Dashboard */}
        {view === 'admin' && !isCreating && !isViewingRegs && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="max-w-5xl mx-auto space-y-8"
          >
            {/* Header com Abas */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-slate-200 pb-4">
              <div>
                <h2 className="text-3xl font-black text-slate-800 tracking-tight">Gestão Pedagógica</h2>
                <p className="text-slate-500 text-sm mt-1">Portal administrativo do Colégio SESI Internacional.</p>
                
                {/* Abas */}
                <div className="flex gap-6 mt-6">
                  <button 
                    onClick={() => setAdminTab('events')} 
                    className={`pb-2 font-bold text-sm border-b-2 transition-all ${adminTab === 'events' ? 'border-[#004a99] text-[#004a99]' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
                  >
                    Eventos
                  </button>
                  <button 
                    onClick={() => setAdminTab('students')} 
                    className={`pb-2 font-bold text-sm border-b-2 transition-all ${adminTab === 'students' ? 'border-[#004a99] text-[#004a99]' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
                  >
                    Gestão de Alunos
                  </button>
                  <button 
                    onClick={() => setAdminTab('categories')} 
                    className={`pb-2 font-bold text-sm border-b-2 transition-all ${adminTab === 'categories' ? 'border-[#004a99] text-[#004a99]' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
                  >
                    Categorias e Tipos
                  </button>
                </div>
              </div>

              {/* Botões do Topo Dinâmicos */}
              <div className="flex gap-3 shrink-0">
                {adminTab === 'events' && (
                  <button 
                    onClick={() => {
                      resetNewEvent();
                      setIsCreating(true);
                    }}
                    className="bg-[#004a99] text-white px-5 py-2.5 rounded-xl font-bold flex items-center gap-2 hover:bg-[#003d80] transition-all shadow-sm"
                  >
                    <Plus className="w-4 h-4" />
                    Novo Evento
                  </button>
                )}
                {adminTab === 'students' && (
                  <>
                    <button 
                      onClick={() => setShowPasteStudentsModal(true)}
                      className="bg-slate-100 text-slate-700 px-5 py-2.5 rounded-xl font-bold hover:bg-slate-200 transition-all border border-slate-200"
                    >
                      Colar Lista
                    </button>
                    <button 
                      onClick={exportStudentsToCSV}
                      className="bg-slate-100 text-slate-700 px-5 py-2.5 rounded-xl font-bold hover:bg-slate-200 transition-all border border-slate-200 flex items-center gap-1.5"
                    >
                      <Download className="w-4 h-4" />
                      Exportar Excel
                    </button>
                    <button 
                      onClick={() => setShowAddStudentModal(true)}
                      className="bg-[#fff200] text-[#004a99] px-5 py-2.5 rounded-xl font-bold hover:bg-[#ffe600] transition-all shadow-sm"
                    >
                      Novo Aluno
                    </button>
                  </>
                )}
                {adminTab === 'categories' && (
                  <button 
                    onClick={() => setShowAddCategoryModal(true)}
                    className="bg-[#004a99] text-white px-5 py-2.5 rounded-xl font-bold flex items-center gap-2 hover:bg-[#003d80] transition-all shadow-sm"
                  >
                    <Plus className="w-4 h-4" />
                    Nova Categoria
                  </button>
                )}
                <button 
                  onClick={() => {
                    setIsAdminAuthenticated(false);
                    setView('user');
                  }}
                  className="bg-slate-100 text-slate-600 px-5 py-2.5 rounded-xl font-bold hover:bg-slate-200 transition-all"
                >
                  Sair
                </button>
              </div>
            </div>

            {/* Painel 1: Eventos */}
            {adminTab === 'events' && (
              <div className="grid grid-cols-1 gap-4">
                {events.length === 0 ? (
                  <div className="bg-white rounded-3xl p-12 text-center border border-dashed border-slate-300">
                    <Calendar className="w-12 h-12 text-slate-200 mx-auto mb-4" />
                    <p className="text-slate-400 font-medium">Nenhum evento cadastrado.</p>
                  </div>
                ) : (
                  events.map(event => {
                    const full = isEventFull(event);
                    return (
                      <motion.div 
                        key={event.id}
                        layout
                        className="bg-white p-5 rounded-2xl border border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-4 hover:shadow-md transition-shadow"
                      >
                        <div className="flex items-center gap-4 w-full sm:w-auto">
                          <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${full ? 'bg-rose-50 text-rose-500' : 'bg-blue-50 text-[#004a99]'}`}>
                            {full ? <Users className="w-6 h-6" /> : <Calendar className="w-6 h-6" />}
                          </div>
                          <div className="min-w-0">
                            <h3 className="font-bold text-slate-800 truncate">{event.name}</h3>
                            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-400 mt-0.5">
                              <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {new Date(event.date).toLocaleDateString('pt-BR')}</span>
                              <span className="w-1 h-1 bg-slate-200 rounded-full"></span>
                              <span className="font-medium text-slate-500">
                                {event.category_name ? `${event.category_name}${event.subcategory_name ? ` · ${event.subcategory_name}` : ''}` : event.type}
                              </span>
                              <span className="w-1 h-1 bg-slate-200 rounded-full"></span>
                              <span>Público: {formatYears(event.years_allowed)}</span>
                              {event.is_paid === 1 && (
                                <>
                                  <span className="w-1 h-1 bg-slate-200 rounded-full"></span>
                                  <span className="text-amber-600 font-bold bg-amber-50 px-1.5 py-0.5 rounded text-[10px]">PAGO</span>
                                </>
                              )}
                              {event.limitar_vagas_por_ano === 1 && (
                                <>
                                  <span className="w-1 h-1 bg-slate-200 rounded-full"></span>
                                  <span className="text-[#004a99] font-bold bg-blue-50 px-1.5 py-0.5 rounded text-[10px]">LIMITE POR ANO: {event.vagas_por_ano}</span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center justify-between sm:justify-end gap-8 w-full sm:w-auto">
                          <div className="text-right">
                            <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Ocupação</div>
                            <div className="flex items-center gap-2">
                              <span className={`text-sm font-black ${full ? 'text-rose-500' : 'text-slate-700'}`}>
                                {event.current_registrations} / {event.max_vagas}
                              </span>
                              <div className="w-16 bg-slate-100 h-1.5 rounded-full overflow-hidden">
                                <div 
                                  className={`h-full ${full ? 'bg-rose-500' : 'bg-[#004a99]'}`}
                                  style={{ width: `${Math.min(100, (event.current_registrations / event.max_vagas) * 100)}%` }}
                                />
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-1">
                            <button 
                              onClick={async () => {
                                setSelectedEvent(event);
                                await fetchRegistrations(event.id);
                                setIsViewingRegs(true);
                              }}
                              className="p-2.5 text-slate-400 hover:text-[#004a99] hover:bg-blue-50 rounded-xl transition-all"
                              title="Ver Inscritos"
                            >
                              <Users className="w-5 h-5" />
                            </button>
                            <button 
                              onClick={() => handleEditEvent(event)}
                              className="p-2.5 text-slate-400 hover:text-[#004a99] hover:bg-slate-50 rounded-xl transition-all"
                              title="Editar"
                            >
                              <Edit className="w-5 h-5" />
                            </button>
                            <button 
                              onClick={() => handleDeleteEvent(event.id)}
                              className="p-2.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all"
                              title="Excluir"
                            >
                              <Trash2 className="w-5 h-5" />
                            </button>
                          </div>
                        </div>
                      </motion.div>
                    );
                  })
                )}
              </div>
            )}

            {/* Painel 2: Alunos */}
            {adminTab === 'students' && (
              <div className="bg-white p-6 rounded-3xl border border-slate-200 space-y-6">
                {/* Filtro e Busca */}
                <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
                  <div className="relative w-full sm:w-72">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input 
                      type="text" 
                      placeholder="Buscar por nome..."
                      value={studentSearch}
                      onChange={(e) => setStudentSearch(e.target.value)}
                      className="pl-10 pr-4 py-2 border border-slate-200 rounded-xl w-full focus:ring-2 focus:ring-[#004a99] outline-none"
                    />
                  </div>
                  <div className="w-full sm:w-48 flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-400 uppercase shrink-0">Ano:</span>
                    <select
                      value={studentGradeFilter}
                      onChange={(e) => setStudentGradeFilter(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#004a99] outline-none text-sm"
                    >
                      <option value="">Todos</option>
                      <option value="6° Ano">6° Ano</option>
                      <option value="7° Ano">7° Ano</option>
                      <option value="8° Ano">8° Ano</option>
                      <option value="9° Ano">9° Ano</option>
                      <option value="1° Ano EM">1° Ano EM</option>
                      <option value="2° Ano EM">2° Ano EM</option>
                      <option value="3° Ano EM">3° Ano EM</option>
                    </select>
                  </div>
                </div>

                {/* Lista de Alunos */}
                <div className="overflow-x-auto border border-slate-100 rounded-2xl">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-xs font-bold text-slate-400 uppercase">
                        <th className="px-6 py-3">Nome do Aluno</th>
                        <th className="px-6 py-3">Ano Escolar</th>
                        <th className="px-6 py-3 text-right">Ações</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-sm">
                      {students
                        .filter(s => {
                          const matchSearch = s.name.toLowerCase().includes(studentSearch.toLowerCase());
                          const matchGrade = !studentGradeFilter || s.grade === studentGradeFilter;
                          return matchSearch && matchGrade;
                        })
                        .map(s => (
                          <tr key={s.id} className="hover:bg-slate-50/50">
                            <td className="px-6 py-3 font-semibold text-slate-800">{s.name}</td>
                            <td className="px-6 py-3 text-slate-500">{s.grade}</td>
                            <td className="px-6 py-3 text-right">
                              <button 
                                onClick={() => handleDeleteStudent(s.id)}
                                className="text-rose-500 hover:bg-rose-50 p-2 rounded-lg transition-colors"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      {students.filter(s => {
                        const matchSearch = s.name.toLowerCase().includes(studentSearch.toLowerCase());
                        const matchGrade = !studentGradeFilter || s.grade === studentGradeFilter;
                        return matchSearch && matchGrade;
                      }).length === 0 && (
                        <tr>
                          <td colSpan={3} className="px-6 py-12 text-center text-slate-400 italic">
                            Nenhum aluno encontrado para os filtros selecionados.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Painel 3: Categorias e Subcategorias */}
            {adminTab === 'categories' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {categories.length === 0 ? (
                  <div className="bg-white rounded-3xl p-12 text-center border border-dashed border-slate-300 md:col-span-2">
                    <p className="text-slate-400 font-medium">Nenhuma categoria cadastrada.</p>
                  </div>
                ) : (
                  categories.map(cat => (
                    <div key={cat.id} className="bg-white p-6 rounded-3xl border border-slate-200 space-y-4">
                      <div className="flex justify-between items-center border-b border-slate-100 pb-3">
                        <h3 className="font-bold text-lg text-slate-800 uppercase tracking-wide">{cat.name}</h3>
                        <button 
                          onClick={() => handleDeleteCategory(cat.id)}
                          className="text-rose-500 hover:bg-rose-50 p-2 rounded-lg transition-colors"
                          title="Remover Categoria"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>

                      {/* Subcategorias / Tipos */}
                      <div className="space-y-2">
                        <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Tipos / Subcategorias:</h4>
                        <div className="flex flex-wrap gap-2">
                          {cat.subcategories.map(sub => (
                            <span 
                              key={sub.id} 
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-full text-xs font-bold text-slate-600"
                            >
                              {sub.name}
                              <button 
                                onClick={() => handleDeleteSubcategory(sub.id)}
                                className="text-slate-400 hover:text-rose-600"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </span>
                          ))}
                          {cat.subcategories.length === 0 && (
                            <span className="text-xs text-slate-400 italic">Nenhum tipo cadastrado</span>
                          )}
                        </div>
                      </div>

                      {/* Input rápido de adicionar subcategoria */}
                      <div className="flex gap-2 pt-2">
                        <input 
                          type="text" 
                          placeholder="Novo tipo..."
                          value={newSubcategoryName[cat.id] || ''}
                          onChange={(e) => setNewSubcategoryName(prev => ({ ...prev, [cat.id]: e.target.value }))}
                          className="flex-1 px-3 py-1.5 border border-slate-200 rounded-xl text-xs focus:ring-1 focus:ring-[#004a99] outline-none"
                        />
                        <button 
                          onClick={() => handleAddSubcategory(cat.id)}
                          className="bg-slate-100 hover:bg-[#004a99] hover:text-white text-slate-600 px-3 py-1.5 rounded-xl text-xs font-bold transition-all border border-slate-200"
                        >
                          Adicionar
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* Modal: Novo Aluno */}
            <AnimatePresence>
              {showAddStudentModal && (
                <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="bg-white rounded-3xl shadow-xl w-full max-w-md overflow-hidden border border-slate-100 animate-scaleIn"
                  >
                    <div className="bg-[#004a99] p-6 text-white flex justify-between items-center">
                      <h3 className="font-bold text-lg">Novo Aluno</h3>
                      <button onClick={() => setShowAddStudentModal(false)} className="text-white hover:opacity-80">
                        <X className="w-5 h-5" />
                      </button>
                    </div>
                    <form onSubmit={handleAddStudent} className="p-6 space-y-4">
                      <div className="space-y-1">
                        <label className="text-xs font-bold text-slate-500 uppercase">Nome Completo</label>
                        <input 
                          type="text" 
                          required 
                          value={newStudentName}
                          onChange={(e) => setNewStudentName(e.target.value)}
                          className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#004a99] outline-none"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-bold text-slate-500 uppercase">Ano Escolar</label>
                        <select 
                          value={newStudentGrade}
                          onChange={(e) => setNewStudentGrade(e.target.value)}
                          className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#004a99] outline-none"
                        >
                          <option value="6° Ano">6° Ano</option>
                          <option value="7° Ano">7° Ano</option>
                          <option value="8° Ano">8° Ano</option>
                          <option value="9° Ano">9° Ano</option>
                          <option value="1° Ano EM">1° Ano EM</option>
                          <option value="2° Ano EM">2° Ano EM</option>
                          <option value="3° Ano EM">3° Ano EM</option>
                        </select>
                      </div>
                      <div className="pt-2 flex gap-3">
                        <button 
                          type="button" 
                          onClick={() => setShowAddStudentModal(false)}
                          className="flex-1 py-3 border border-slate-200 text-slate-500 rounded-xl font-bold hover:bg-slate-50 transition-colors"
                        >
                          Cancelar
                        </button>
                        <button 
                          type="submit" 
                          className="flex-1 py-3 bg-[#004a99] text-white rounded-xl font-bold hover:bg-[#003d80] transition-colors"
                        >
                          Cadastrar
                        </button>
                      </div>
                    </form>
                  </motion.div>
                </div>
              )}
            </AnimatePresence>

            {/* Modal: Colar Lista de Alunos */}
            <AnimatePresence>
              {showPasteStudentsModal && (
                <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="bg-white rounded-3xl shadow-xl w-full max-w-lg overflow-hidden border border-slate-100 animate-scaleIn"
                  >
                    <div className="bg-[#004a99] p-6 text-white flex justify-between items-center">
                      <h3 className="font-bold text-lg">Colar Lista de Alunos</h3>
                      <button onClick={() => setShowPasteStudentsModal(false)} className="text-white hover:opacity-80">
                        <X className="w-5 h-5" />
                      </button>
                    </div>
                    <form onSubmit={handlePasteStudents} className="p-6 space-y-4">
                      <div className="space-y-1">
                        <label className="text-xs font-bold text-slate-500 uppercase">Ano Escolar de Destino</label>
                        <select 
                          value={pasteStudentGrade}
                          onChange={(e) => setPasteStudentGrade(e.target.value)}
                          className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#004a99] outline-none"
                        >
                          <option value="6° Ano">6° Ano</option>
                          <option value="7° Ano">7° Ano</option>
                          <option value="8° Ano">8° Ano</option>
                          <option value="9° Ano">9° Ano</option>
                          <option value="1° Ano EM">1° Ano EM</option>
                          <option value="2° Ano EM">2° Ano EM</option>
                          <option value="3° Ano EM">3° Ano EM</option>
                        </select>
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-bold text-slate-500 uppercase">Nomes (um por linha)</label>
                        <textarea 
                          rows={8}
                          required
                          value={pasteStudentNamesText}
                          placeholder="Exemplo:&#10;Luiz Silva&#10;Maria Santos&#10;Pedro Oliveira"
                          onChange={(e) => setPasteStudentNamesText(e.target.value)}
                          className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#004a99] outline-none font-mono text-sm shadow-inner"
                        />
                      </div>
                      <div className="pt-2 flex gap-3">
                        <button 
                          type="button" 
                          onClick={() => setShowPasteStudentsModal(false)}
                          className="flex-1 py-3 border border-slate-200 text-slate-500 rounded-xl font-bold hover:bg-slate-50 transition-colors"
                        >
                          Cancelar
                        </button>
                        <button 
                          type="submit" 
                          className="flex-1 py-3 bg-[#004a99] text-white rounded-xl font-bold hover:bg-[#003d80] transition-colors"
                        >
                          Importar Lista
                        </button>
                      </div>
                    </form>
                  </motion.div>
                </div>
              )}
            </AnimatePresence>

            {/* Modal: Nova Categoria */}
            <AnimatePresence>
              {showAddCategoryModal && (
                <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="bg-white rounded-3xl shadow-xl w-full max-w-md overflow-hidden border border-slate-100 animate-scaleIn"
                  >
                    <div className="bg-[#004a99] p-6 text-white flex justify-between items-center">
                      <h3 className="font-bold text-lg">Nova Categoria</h3>
                      <button onClick={() => setShowAddCategoryModal(false)} className="text-white hover:opacity-80">
                        <X className="w-5 h-5" />
                      </button>
                    </div>
                    <form onSubmit={handleAddCategory} className="p-6 space-y-4">
                      <div className="space-y-1">
                        <label className="text-xs font-bold text-slate-500 uppercase">Nome da Categoria</label>
                        <input 
                          type="text" 
                          required 
                          value={newCategoryName}
                          onChange={(e) => setNewCategoryName(e.target.value)}
                          className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#004a99] outline-none"
                        />
                      </div>
                      <div className="pt-2 flex gap-3">
                        <button 
                          type="button" 
                          onClick={() => setShowAddCategoryModal(false)}
                          className="flex-1 py-3 border border-slate-200 text-slate-500 rounded-xl font-bold hover:bg-slate-50 transition-colors"
                        >
                          Cancelar
                        </button>
                        <button 
                          type="submit" 
                          className="flex-1 py-3 bg-[#004a99] text-white rounded-xl font-bold hover:bg-[#003d80] transition-colors"
                        >
                          Criar Categoria
                        </button>
                      </div>
                    </form>
                  </motion.div>
                </div>
              )}
            </AnimatePresence>
          </motion.div>
        )}

        {/* Create Event Form */}
        {isCreating && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="max-w-4xl mx-auto"
          >
            <div className="flex items-center gap-4 mb-8">
              <button 
                onClick={() => {
                  setIsCreating(false);
                  setEditingEventId(null);
                }}
                className="p-2 hover:bg-slate-100 rounded-full transition-all"
              >
                <ArrowLeft className="w-6 h-6 text-slate-600" />
              </button>
              <div>
                <h2 className="text-3xl font-black text-slate-800">
                  {editingEventId ? 'Editar Evento' : 'Novo Evento'}
                </h2>
                {editingEventId && <p className="text-slate-500 text-sm">Alterando as informações do evento selecionado.</p>}
              </div>
            </div>

            <form onSubmit={handleSubmitEvent} className="space-y-6 sm:space-y-8">
              {/* Basic Info Section */}
              <div className="bg-white p-5 sm:p-8 rounded-2xl sm:rounded-3xl shadow-sm border border-slate-200">
                <h3 className="text-lg font-bold mb-6 flex items-center gap-2 text-[#004a99]">
                  <Settings className="w-5 h-5" />
                  Informações Básicas
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
                  <div className="space-y-2 md:col-span-2">
                    <label className="text-sm font-bold text-slate-600">Nome do Evento</label>
                    <input 
                      type="text" 
                      required
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#004a99] outline-none"
                      value={newEvent.name}
                      onChange={e => setNewEvent({ ...newEvent, name: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-600">Categoria</label>
                    <select 
                      required
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#004a99] outline-none"
                      value={newEvent.category_id || ''}
                      onChange={e => {
                        const catId = e.target.value ? parseInt(e.target.value) : undefined;
                        const catName = categories.find(c => c.id === catId)?.name || '';
                        setNewEvent({ 
                          ...newEvent, 
                          category_id: catId, 
                          subcategory_id: undefined,
                          type: catName
                        });
                      }}
                    >
                      <option value="">Selecione uma categoria...</option>
                      {categories.map(cat => (
                        <option key={cat.id} value={cat.id}>{cat.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-600">Tipo / Subcategoria</label>
                    <select 
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#004a99] outline-none disabled:opacity-60"
                      value={newEvent.subcategory_id || ''}
                      disabled={!newEvent.category_id}
                      onChange={e => {
                        const subId = e.target.value ? parseInt(e.target.value) : undefined;
                        setNewEvent({ ...newEvent, subcategory_id: subId });
                      }}
                    >
                      <option value="">Selecione um tipo...</option>
                      {newEvent.category_id && categories.find(c => c.id === newEvent.category_id)?.subcategories.map(sub => (
                        <option key={sub.id} value={sub.id}>{sub.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-600">Máximo de Vagas</label>
                    <input 
                      type="number" 
                      required
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#004a99] outline-none"
                      value={newEvent.max_vagas}
                      onChange={e => setNewEvent({ ...newEvent, max_vagas: parseInt(e.target.value) })}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-600">Data do Evento</label>
                    <input 
                      type="date" 
                      required
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#004a99] outline-none"
                      value={newEvent.date}
                      onChange={e => setNewEvent({ ...newEvent, date: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-600">Horário</label>
                    <input 
                      type="time" 
                      required
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#004a99] outline-none"
                      value={newEvent.time}
                      onChange={e => setNewEvent({ ...newEvent, time: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-600">Data Limite de Inscrição</label>
                    <input 
                      type="datetime-local" 
                      required
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#004a99] outline-none"
                      value={newEvent.deadline}
                      onChange={e => setNewEvent({ ...newEvent, deadline: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <label className="text-sm font-bold text-slate-600">Descrição</label>
                    <textarea 
                      rows={3}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#004a99] outline-none"
                      value={newEvent.description}
                      onChange={e => setNewEvent({ ...newEvent, description: e.target.value })}
                    />
                  </div>
                </div>
              </div>

              {/* Restrictions and Access Section */}
              <div className="bg-white p-5 sm:p-8 rounded-2xl sm:rounded-3xl shadow-sm border border-slate-200">
                <h3 className="text-lg font-bold mb-6 flex items-center gap-2 text-[#004a99]">
                  <LockIcon className="w-5 h-5" />
                  Restrições e Acesso
                </h3>
                
                <div className="space-y-6">
                  {/* Allowed Years */}
                  <div className="space-y-3">
                    <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2">
                      <label className="text-sm font-bold text-slate-700">Anos Escolares Permitidos</label>
                      <div className="flex flex-wrap gap-1.5">
                        <button 
                          type="button"
                          onClick={() => setNewEvent({ ...newEvent, years_allowed: '6° Ano, 7° Ano, 8° Ano, 9° Ano, 1° Ano EM, 2° Ano EM, 3° Ano EM' })}
                          className="text-xs bg-slate-100 hover:bg-slate-200 text-[#004a99] px-2.5 py-1.5 rounded-lg font-bold transition-colors"
                        >
                          Livre (Todos)
                        </button>
                        <button 
                          type="button"
                          onClick={() => setNewEvent({ ...newEvent, years_allowed: '6° Ano, 7° Ano, 8° Ano, 9° Ano' })}
                          className="text-xs bg-slate-100 hover:bg-slate-200 text-[#004a99] px-2.5 py-1.5 rounded-lg font-bold transition-colors"
                        >
                          Fund. 2
                        </button>
                        <button 
                          type="button"
                          onClick={() => setNewEvent({ ...newEvent, years_allowed: '1° Ano EM, 2° Ano EM, 3° Ano EM' })}
                          className="text-xs bg-slate-100 hover:bg-slate-200 text-[#004a99] px-2.5 py-1.5 rounded-lg font-bold transition-colors"
                        >
                          Ensino Médio
                        </button>
                        <button 
                          type="button"
                          onClick={() => setNewEvent({ ...newEvent, years_allowed: '' })}
                          className="text-xs bg-slate-100 hover:bg-slate-200 text-slate-500 px-2.5 py-1.5 rounded-lg font-bold transition-colors"
                        >
                          Limpar
                        </button>
                      </div>
                    </div>
                    
                    <div className="flex flex-wrap gap-2">
                      {['6° Ano', '7° Ano', '8° Ano', '9° Ano', '1° Ano EM', '2° Ano EM', '3° Ano EM'].map(year => {
                        const isSelected = newEvent.years_allowed?.split(',').map(y => y.trim()).includes(year);
                        return (
                          <button
                            key={year}
                            type="button"
                            onClick={() => {
                              const current = newEvent.years_allowed ? newEvent.years_allowed.split(',').map(y => y.trim()).filter(Boolean) : [];
                              let updated;
                              if (current.includes(year)) {
                                updated = current.filter(y => y !== year);
                              } else {
                                updated = [...current, year];
                              }
                              setNewEvent({ ...newEvent, years_allowed: updated.join(', ') });
                            }}
                            className={`px-3 py-2 rounded-xl text-xs font-bold border transition-all ${
                              isSelected 
                                ? 'bg-blue-50 border-[#004a99] text-[#004a99] shadow-sm shadow-blue-50' 
                                : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                            }`}
                          >
                            {year}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <hr className="border-slate-100" />

                  {/* Options */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <label className="flex items-start gap-3 p-4 bg-slate-50 rounded-2xl border border-slate-200 hover:bg-slate-100/50 transition-all cursor-pointer select-none">
                      <input 
                        type="checkbox"
                        checked={newEvent.is_paid === 1}
                        onChange={e => setNewEvent({ ...newEvent, is_paid: e.target.checked ? 1 : 0 })}
                        className="w-5 h-5 mt-0.5 text-[#004a99] border-slate-300 rounded focus:ring-[#004a99]"
                      />
                      <div>
                        <span className="text-sm font-bold text-slate-800 block">Atividade Paga</span>
                        <span className="text-xs text-slate-400">Exige que o estudante confirme ciência dos custos da atividade antes de se inscrever.</span>
                      </div>
                    </label>

                    <div className="flex flex-col gap-3 p-4 bg-slate-50 rounded-2xl border border-slate-200 hover:bg-slate-100/50 transition-all select-none">
                      <label className="flex items-start gap-3 cursor-pointer">
                        <input 
                          type="checkbox"
                          checked={newEvent.limitar_vagas_por_ano === 1}
                          onChange={e => {
                            const checked = e.target.checked;
                            setNewEvent({ 
                              ...newEvent, 
                              limitar_vagas_por_ano: checked ? 1 : 0,
                              vagas_por_ano: checked ? (newEvent.vagas_por_ano || 5) : undefined
                            });
                          }}
                          className="w-5 h-5 mt-0.5 text-[#004a99] border-slate-300 rounded focus:ring-[#004a99]"
                        />
                        <div>
                          <span className="text-sm font-bold text-slate-800 block">Limitar Vagas por Ano</span>
                          <span className="text-xs text-slate-400">Define um limite máximo de inscritos para cada ano escolar permitido individualmente.</span>
                        </div>
                      </label>
                      {newEvent.limitar_vagas_por_ano === 1 && (
                        <div className="pl-8 mt-1 space-y-1 w-full animate-in fade-in slide-in-from-top-1 duration-200">
                          <label className="text-xs font-bold text-slate-600 block">Número de vagas por ano escolar</label>
                          <input 
                            type="number" 
                            min={1}
                            required
                            className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-[#004a99] text-sm"
                            value={newEvent.vagas_por_ano || ''}
                            onChange={e => setNewEvent({ ...newEvent, vagas_por_ano: parseInt(e.target.value) || 0 })}
                          />
                        </div>
                      )}
                    </div>

                    <label className="flex items-start gap-3 p-4 bg-slate-50 rounded-2xl border border-slate-200 hover:bg-slate-100/50 transition-all cursor-pointer select-none md:col-span-2">
                      <input 
                        type="checkbox"
                        checked={newEvent.restringir_duplicidade === 1}
                        onChange={e => setNewEvent({ ...newEvent, restringir_duplicidade: e.target.checked ? 1 : 0 })}
                        className="w-5 h-5 mt-0.5 text-[#004a99] border-slate-300 rounded focus:ring-[#004a99]"
                      />
                      <div>
                        <span className="text-sm font-bold text-slate-800 block">Restringir Inscrição Única</span>
                        <span className="text-xs text-slate-400">Impede que o mesmo aluno se inscreva em mais de um evento pertencente a esta Categoria e Tipo.</span>
                      </div>
                    </label>
                  </div>
                </div>
              </div>

              {/* Custom Fields Section */}
              <div className="bg-white p-5 sm:p-8 rounded-2xl sm:rounded-3xl shadow-sm border border-slate-200">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-lg font-bold flex items-center gap-2 text-[#004a99]">
                    <PlusCircle className="w-5 h-5" />
                    Campos do Formulário
                  </h3>
                  <button 
                    type="button"
                    onClick={addField}
                    className="text-sm font-bold text-[#004a99] hover:underline flex items-center gap-1"
                  >
                    <Plus className="w-4 h-4" />
                    Adicionar
                  </button>
                </div>

                <div className="space-y-4">
                  {newEvent.fields?.map((field, index) => (
                    <motion.div 
                      key={index}
                      layout
                      className="p-4 bg-slate-50 rounded-xl sm:rounded-2xl border border-slate-200 flex flex-col md:flex-row gap-4 items-start"
                    >
                      <div className="pt-2 hidden md:block">
                        <GripVertical className="w-5 h-5 text-slate-300" />
                      </div>
                      <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 w-full">
                        <div className="space-y-1">
                          <label className="text-[10px] font-black uppercase text-slate-400">Rótulo (Label)</label>
                          <input 
                            type="text" 
                            className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm outline-none focus:ring-1 focus:ring-[#004a99]"
                            value={field.field_label}
                            onChange={e => updateField(index, { field_label: e.target.value, field_name: e.target.value.toLowerCase().replace(/\s+/g, '_') })}
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] font-black uppercase text-slate-400">Tipo</label>
                          <select 
                            className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm outline-none focus:ring-1 focus:ring-[#004a99]"
                            value={field.field_type}
                            onChange={e => updateField(index, { field_type: e.target.value as any })}
                          >
                            <option value="text">Texto Simples</option>
                            <option value="textarea">Texto Longo</option>
                            <option value="select">Seleção (Dropdown)</option>
                            <option value="radio">Múltipla Escolha</option>
                          </select>
                        </div>
                        <div className="flex items-center gap-4 pt-6">
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input 
                              type="checkbox" 
                              checked={field.is_required}
                              className="w-4 h-4 text-[#004a99] rounded"
                              onChange={e => updateField(index, { is_required: e.target.checked })}
                            />
                            <span className="text-xs font-bold text-slate-600">Obrigatório</span>
                          </label>
                          <button 
                            type="button"
                            onClick={() => removeField(index)}
                            className="p-2 text-rose-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all ml-auto"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                        {(field.field_type === 'select' || field.field_type === 'radio') && (
                          <div className="md:col-span-3 space-y-1">
                            <label className="text-[10px] font-black uppercase text-slate-400">Opções (separadas por vírgula)</label>
                            <input 
                              type="text" 
                              placeholder="Opção 1, Opção 2, Opção 3"
                              className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm outline-none focus:ring-1 focus:ring-[#004a99]"
                              value={field.options || ''}
                              onChange={e => updateField(index, { options: e.target.value })}
                            />
                          </div>
                        )}
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-4">
                <button 
                  type="button"
                  onClick={() => setIsCreating(false)}
                  className="px-8 py-3 rounded-2xl font-bold text-slate-500 hover:bg-slate-100 transition-all"
                >
                  Cancelar
                </button>
                <button 
                  type="submit"
                  className="px-8 py-3 bg-[#004a99] text-white rounded-2xl font-bold hover:bg-[#003d80] transition-all shadow-lg shadow-blue-100"
                >
                  {editingEventId ? 'Salvar Alterações' : 'Publicar Evento'}
                </button>
              </div>
            </form>
          </motion.div>
        )}

        {/* Registrations List View */}
        {isViewingRegs && selectedEvent && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="space-y-8"
          >
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <button 
                  onClick={() => setIsViewingRegs(false)}
                  className="p-2 hover:bg-slate-100 rounded-full transition-all no-print"
                >
                  <ArrowLeft className="w-6 h-6 text-slate-600" />
                </button>
                <div>
                  <div className="hidden print:block mb-4">
                    <h1 className="text-3xl font-black text-[#004a99]">SESI Internacional</h1>
                    <p className="text-slate-500">Relatório de Inscrições</p>
                  </div>
                  <h2 className="text-2xl font-black text-slate-800">{selectedEvent.name}</h2>
                  <p className="text-slate-500">Lista de inscritos ({registrations.length} total)</p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <button 
                  onClick={copyToClipboard}
                  className="bg-white border border-slate-200 px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 hover:bg-slate-50 transition-all"
                >
                  <Copy className="w-4 h-4" />
                  Copiar
                </button>
                <button 
                  onClick={printList}
                  className="bg-white border border-slate-200 px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 hover:bg-slate-50 transition-all"
                >
                  <Printer className="w-4 h-4" />
                  Imprimir / PDF
                </button>
                <button 
                  onClick={exportToCSV}
                  className="bg-[#004a99] text-white px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 hover:bg-[#003d80] transition-all"
                >
                  <Download className="w-4 h-4" />
                  Excel (CSV)
                </button>
              </div>
            </div>

            {/* Desktop Table View */}
            <div className="hidden md:block bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200">
                      <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Data</th>
                      {regFields.map(field => (
                        <th key={field.id} className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">
                          {field.field_label}
                        </th>
                      ))}
                      <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-right no-print">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {registrations.map(reg => (
                      <tr key={reg.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-6 py-4 text-xs text-slate-500 whitespace-nowrap">
                          {new Date(reg.registration_date).toLocaleString('pt-BR')}
                        </td>
                        {regFields.map(field => (
                          <td key={field.id} className="px-6 py-4 text-sm text-slate-700">
                            {reg.data[field.field_name] || '-'}
                          </td>
                        ))}
                        <td className="px-6 py-4 text-sm text-right no-print">
                          <button 
                            onClick={() => handleDeleteRegistration(reg.id)}
                            className="text-rose-500 hover:bg-rose-50 p-2 rounded-lg transition-colors"
                            title="Remover Inscrição"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                    {registrations.length === 0 && (
                      <tr>
                        <td colSpan={regFields.length + 2} className="px-6 py-20 text-center text-slate-400 italic">
                          Nenhuma inscrição realizada até o momento.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Mobile Card View */}
            <div className="md:hidden space-y-4">
              {registrations.length === 0 ? (
                <div className="bg-white rounded-2xl p-12 text-center border border-dashed border-slate-300">
                  <p className="text-slate-400 italic">Nenhuma inscrição realizada.</p>
                </div>
              ) : (
                registrations.map(reg => (
                  <div key={reg.id} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-3">
                    <div className="flex justify-between items-center border-b border-slate-100 pb-2 mb-2">
                      <div>
                        <span className="text-[10px] font-black uppercase text-slate-400 block">Data da Inscrição</span>
                        <span className="text-xs text-slate-500">{new Date(reg.registration_date).toLocaleString('pt-BR')}</span>
                      </div>
                      <button 
                        onClick={() => handleDeleteRegistration(reg.id)}
                        className="text-rose-500 hover:bg-rose-50 p-2 rounded-lg transition-colors"
                        title="Remover Inscrição"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      {regFields.map(field => (
                        <div key={field.id} className="space-y-1">
                          <span className="text-[10px] font-black uppercase text-slate-400 block">{field.field_label}</span>
                          <span className="text-sm text-slate-700 font-medium break-words">{reg.data[field.field_name] || '-'}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))
              )}
            </div>
          </motion.div>
        )}
      </main>

      {/* Footer */}
      <footer className="mt-20 border-t border-slate-200 py-12 bg-white">
        <div className="max-w-7xl mx-auto px-4 text-center">
          <div className="flex justify-center mb-6">
             <div className="bg-[#004a99] p-3 rounded-2xl cursor-pointer hover:scale-110 transition-transform active:scale-95" onClick={handleSwitchToAdmin}>
                <Calendar className="w-8 h-8 text-[#fff200]" />
             </div>
          </div>
          <p className="text-slate-500 text-sm font-medium">© 2024 Colégio SESI Internacional. Todos os direitos reservados.</p>
          <div className="mt-4 flex justify-center gap-6 text-xs font-bold text-slate-400 uppercase tracking-widest">
            <a href="#" className="hover:text-[#004a99]">Privacidade</a>
            <a href="#" className="hover:text-[#004a99]">Termos</a>
            <button onClick={handleSwitchToAdmin} className="opacity-0 hover:opacity-100 transition-opacity cursor-default">Admin</button>
          </div>
        </div>
      </footer>

      {/* PIN Verification Modal */}
      <AnimatePresence>
        {showPinModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-sm overflow-hidden border border-slate-100"
            >
              <div className="p-8 text-center">
                <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-6">
                  <LockIcon className="w-8 h-8 text-slate-400" />
                </div>
                
                <h2 className="text-2xl font-bold text-slate-900 mb-2">Verificação</h2>
                <p className="text-slate-500 text-sm mb-8">Insira o código de segurança para acessar o painel administrativo.</p>

                <form onSubmit={handlePinSubmit} className="space-y-8">
                  <div className="flex justify-center gap-3">
                    {[0, 1, 2, 3].map((i) => (
                      <div 
                        key={i}
                        className={`w-4 h-4 rounded-full border-2 transition-all duration-300 ${
                          pinInput.length > i 
                            ? 'bg-emerald-500 border-emerald-500 scale-110' 
                            : pinError ? 'border-red-500 animate-shake' : 'border-slate-200'
                        }`}
                      />
                    ))}
                  </div>

                  <div className="grid grid-cols-3 gap-4">
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
                      <button
                        key={num}
                        type="button"
                        onClick={() => pinInput.length < 4 && setPinInput(prev => prev + num)}
                        className="h-16 w-16 rounded-2xl bg-slate-50 text-xl font-bold text-slate-700 hover:bg-slate-100 active:bg-slate-200 transition-colors mx-auto"
                      >
                        {num}
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => setPinInput('')}
                      className="h-16 w-16 rounded-2xl bg-red-50 text-xs font-bold text-red-500 hover:bg-red-100 mx-auto"
                    >
                      Limpar
                    </button>
                    <button
                      type="button"
                      onClick={() => pinInput.length < 4 && setPinInput(prev => prev + '0')}
                      className="h-16 w-16 rounded-2xl bg-slate-50 text-xl font-bold text-slate-700 hover:bg-slate-100 mx-auto"
                    >
                      0
                    </button>
                    <button
                      type="button"
                      onClick={() => setPinInput(prev => prev.slice(0, -1))}
                      className="h-16 w-16 rounded-2xl bg-slate-50 flex items-center justify-center hover:bg-slate-100 mx-auto"
                    >
                      <X className="w-6 h-6 text-slate-400" />
                    </button>
                  </div>

                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        setShowPinModal(false);
                        setPinInput('');
                      }}
                      className="flex-1 py-4 text-slate-500 font-bold text-sm hover:bg-slate-50 rounded-2xl transition-colors"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      disabled={pinInput.length !== 4}
                      className={`flex-1 py-4 rounded-2xl font-bold text-sm shadow-lg transition-all ${
                        pinInput.length === 4 
                          ? 'bg-emerald-600 text-white shadow-emerald-200 hover:bg-emerald-700' 
                          : 'bg-slate-100 text-slate-400 shadow-none cursor-not-allowed'
                      }`}
                    >
                      Verificar
                    </button>
                  </div>
                </form>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
