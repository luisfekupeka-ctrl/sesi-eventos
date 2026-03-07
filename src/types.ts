export interface Event {
  id: string;
  name: string;
  description: string;
  type: string;
  date: string;
  startTime: string;
  duration: string;
  maxCapacity: number;
  location?: string;
  targetAudience: 'alunos' | 'responsaveis' | 'ambos';
  configFields: string; // JSON string
  currentRegistrations: number;
  allowedGrades?: string[]; // Array of grades allowed to register
  approvalMode?: 'automatic' | 'manual';
  createdAt: string;
}

export interface Registration {
  id: string;
  eventId: string;
  formData: any;
  status: 'pending' | 'approved';
  createdAt: string;
}

export interface EventConfigFields {
  // Alunos
  studentName?: boolean;
  studentSurname?: boolean;
  studentGrade?: boolean;
  studentClass?: boolean;
  studentEmail?: boolean;
  studentPhone?: boolean;
  studentCpf?: boolean;
  
  // Responsaveis
  parentName?: boolean;
  parentPhone?: boolean;
  parentEmail?: boolean;
  parentCpf?: boolean;
  parentStudentName?: boolean;
  parentStudentGrade?: boolean;
  parentStudentClass?: boolean;
}

export interface AppSettings {
  visibleFilters: {
    search: boolean;
    grade: boolean;
    type: boolean;
    quickGrades: boolean;
  };
  eventTypes: string[];
  grades: string[];
}

export const DEFAULT_SETTINGS: AppSettings = {
  visibleFilters: {
    search: true,
    grade: true,
    type: true,
    quickGrades: true,
  },
  eventTypes: [
    'Oficina',
    'After',
    'Reunião',
    'Projeto',
    'Palestra',
    'Atividade Escolar',
    'Outro'
  ],
  grades: [
    '6º ano',
    '7º ano',
    '8º ano',
    '9º ano',
    '1º ano EM',
    '2º ano EM',
    '3º ano EM'
  ]
};

export const CLASSES = ['A', 'B', 'C', 'D'];
