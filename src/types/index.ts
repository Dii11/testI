// API Response Types
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}

// Authentication Types
export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phoneNumber?: string;
  dateOfBirth?: string;
  gender?: 'male' | 'female' | 'other';
  address?: string;
  profilePicture?: string;
  accountType: 'customer' | 'health_specialist' | 'admin';
  emailVerified: boolean;
  referralCode?: string;
  countryCode?: string;
  currency?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn?: number; // ✅ Optional: seconds until access token expires (provided by backend)
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  accountType: 'customer' | 'health_specialist';
  phoneNumber?: string;
  dateOfBirth?: string;
  gender?: 'male' | 'female' | 'other';
  address?: string;
  countryCode?: string;
  currency?: string;
}

// Doctor Types
export interface Doctor {
  doctor_id: number;
  user_id: number;
  license_number: string;
  years_of_experience: number;
  bio?: string;
  consultation_fee: number;
  rating: number;
  total_reviews: number;
  is_available: boolean;
  user: User;
  specialties: Specialty[];
  hospitals: Hospital[];
  availability?: DoctorAvailability[];
}

export interface Specialty {
  specialty_id: number;
  name: string;
  description?: string;
}

export interface Hospital {
  hospital_id: number;
  name: string;
  address: string;
  phone_number: string;
  email?: string;
  website?: string;
}

export interface DoctorAvailability {
  availability_id: number;
  doctor_id: number;
  day_of_week: number;
  start_time: string;
  end_time: string;
  is_available: boolean;
}

// Appointment Types
export interface Appointment {
  appointment_id: number;
  patient_id: number;
  doctor_id: number;
  hospital_id?: number;
  appointment_date: string;
  duration_minutes: number;
  fee: number;
  status: 'scheduled' | 'confirmed' | 'in_progress' | 'completed' | 'cancelled' | 'no_show';
  symptoms?: string;
  notes?: string;
  type: 'in_person' | 'video_call' | 'home_visit';
  doctor: Doctor;
  hospital?: Hospital;
  created_at: string;
  updated_at: string;
}

export interface CreateAppointmentRequest {
  doctor_id: number;
  hospital_id?: number;
  appointment_date: string;
  symptoms?: string;
  type: 'in_person' | 'video_call' | 'home_visit';
}

// Health Data Types
export interface HealthData {
  id: number;
  dataType: 'heart_rate' | 'blood_pressure' | 'steps' | 'weight' | 'blood_glucose' | 'temperature';
  value: number;
  unit: string;
  recordedAt: string;
  sourceDevice?: string;
  createdAt: string;
}

export interface HealthSummary {
  totalDataPoints: number;
  latestSync: string;
  dataTypes: string[];
  summary: {
    steps: { total: number; average: number; goal: number };
    heartRate: { average: number; min: number; max: number };
    weight: { current: number; change: number; trend: string };
  };
}

export interface HealthInsight {
  type: 'info' | 'warning' | 'success' | 'alert';
  title: string;
  message: string;
  metric: string;
  value: number;
  recommendation?: string;
  priority: 'low' | 'medium' | 'high';
  createdAt: string;
}

// Video Call Types
export interface VideoCallSession {
  sessionId: string;
  channelName: string;
  token: string;
  uid: number;
  appId: string;
  expiresAt: string;
  appointmentId: number;
  doctorId: number;
  patientId: number;
  status: 'scheduled' | 'active' | 'ended' | 'cancelled' | 'failed';
}

// Chat Types
export interface ChatRoom {
  chatId: string;
  appointmentId: number;
  doctorId: number;
  patientId: number;
  status: 'active' | 'archived' | 'closed';
  createdAt: string;
  lastMessageAt?: string;
  lastMessage?: string;
  unreadCount: {
    doctor: number;
    patient: number;
  };
}

export interface ChatMessage {
  messageId: string;
  chatId: string;
  senderId: number;
  senderRole: 'doctor' | 'patient';
  messageType: 'text' | 'image' | 'file' | 'voice' | 'system';
  content: string;
  timestamp: string;
  readBy: {
    userId: number;
    readAt: string;
  }[];
  isEdited?: boolean;
  editedAt?: string;
  replyToId?: string;
  attachments?: {
    id: string;
    fileName: string;
    fileSize: number;
    mimeType: string;
    url: string;
    thumbnailUrl?: string;
  }[];
}

// Navigation Types
export interface RootStackParamList {
  Auth: undefined;
  Main: undefined;
  VideoCall: { roomUrl: string; provider: string; doctorId?: string; customerId?: string };
  AudioCall: { roomUrl: string; provider: string; doctorId?: string; customerId?: string };
}

export interface CallStackParamList {
  VideoCall: { roomUrl: string; provider: string; doctorId?: string; customerId?: string };
  AudioCall: { roomUrl: string; provider: string; doctorId?: string; customerId?: string };
}

export interface AuthStackParamList {
  Login: undefined;
  Register: undefined;
  ReferralCode: { phoneNumber: string; registrationData: any };
  Verification: { phoneNumber: string };
  CreatePassword: { phoneNumber: string };
  AccountReady: undefined;
  ForgotPassword: undefined;
}

export interface MainTabParamList {
  Home: undefined;
  Doctors: undefined;
  Appointments: undefined;
  Chat: { chatId?: string };
  Profile: undefined;
}

export interface DoctorsStackParamList {
  DoctorsList: undefined;
  DoctorDetails: { doctorId: number };
  BookAppointment: { doctorId: number };
}

export interface AppointmentsStackParamList {
  AppointmentsList: undefined;
  AppointmentDetails: { appointmentId: number };
  VideoCall: { sessionId: string };
}

export interface ChatStackParamList {
  ChatList: undefined;
  ChatRoom: { chatId: string; appointmentId: number };
}

// Form Types
export interface FormFieldError {
  message: string;
}

export interface FormState<T = any> {
  values: T;
  errors: Record<string, FormFieldError>;
  touched: Record<string, boolean>;
  isSubmitting: boolean;
  isValid: boolean;
}

// State Types
export interface AuthState {
  user: User | null;
  tokens: AuthTokens | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
}

export interface DoctorsState {
  doctors: Doctor[];
  selectedDoctor: Doctor | null;
  isLoading: boolean;
  error: string | null;
  searchQuery: string;
  filters: {
    specialty?: string;
    hospital?: string;
    availability?: boolean;
    rating?: number;
  };
}

export interface AppointmentsState {
  appointments: Appointment[];
  isLoading: boolean;
  error: string | null;
}

export interface HealthDataState {
  data: HealthData[];
  summary: HealthSummary | null;
  insights: HealthInsight[];
  isLoading: boolean;
  error: string | null;
  lastSync: string | null;
}

export interface ChatState {
  rooms: ChatRoom[];
  messages: Record<string, ChatMessage[]>;
  activeRoom: string | null;
  isLoading: boolean;
  error: string | null;
  isConnected: boolean;
}

export interface VideoCallState {
  activeSession: VideoCallSession | null;
  isInCall: boolean;
  isLoading: boolean;
  error: string | null;
  callStats: {
    duration: number;
    quality: 'excellent' | 'good' | 'poor' | 'bad';
    participants: number;
  } | null;
}

// Utility Types
export interface PaginationParams {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface SearchParams extends PaginationParams {
  query?: string;
  filters?: Record<string, any>;
}

export interface LoadingState {
  isLoading: boolean;
  error: string | null;
}
