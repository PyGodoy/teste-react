import React, { useState, useEffect } from 'react';
import { useAuthStore } from '../store/authStore';
import { supabase } from '../lib/supabase';
import MyTimes from '../components/MyTimes';
import NotificationToast from '../components/NotificationToast';
 
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { Activity, AlertTriangle, Award, Bell, Calendar, CheckCircle, ChevronDown, ChevronUp, Clock, Info, Mail, MapPin, Phone, Timer, Users } from 'lucide-react';

interface Training {
  id: number;
  title: string;
  description: string;
  date: string;
  duration: number;
  difficulty: string;
  professor_id: string;
}

interface CompletionForm {
  trainingId: number | null;
  professorId: string | null;
  feedback: string;
  maintainedTime: string;
  completedDate: string;
}

interface PerformanceData {
  date: string;
  seconds: number;
  displayTime: string;
}

interface Class {
  id: number;
  professor_id: string;
  title: string;
  date: string;
  time: string;
  duration: number;
  max_students: number;
  status: 'active' | 'cancelled';
  created_at: string;
  professor: {
    name: string;
  };
  class_checkins: {
    student_id: string;
  }[];
}

interface Notice {
  message: string;
  created_at: string;
}

interface CustomNotification {
  id: string;
  message: string;
  read: boolean;
}


type PeriodFilter = 'all' | 'week' | 'month' | 'custom';
type AverageView = 'daily' | 'weekly' | 'monthly';
type ActiveTab = 'trainings' | 'times' | 'performance' | 'checkin' | 'info';

export default function AlunoDashboard() {
  const { user } = useAuthStore();
  const [trainings, setTrainings] = useState<Training[]>([]);
  const [expandedWeeks, setExpandedWeeks] = useState<string[]>([]);
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [loading, setLoading] = useState(true);
  const [notifications, setNotifications] = useState<CustomNotification[]>([]);
  const [showNotification, setShowNotification] = useState(false);
  const [lastNoticeId, setLastNoticeId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<ActiveTab>(() => {
    // Tenta recuperar a aba salva do localStorage, se não existir usa 'trainings'
    const savedTab = localStorage.getItem('activeTab');
    return (savedTab as ActiveTab) || 'trainings';
  });
  const [classes, setClasses] = useState<Class[]>([]);
  const [completionForm, setCompletionForm] = useState<CompletionForm>({
    trainingId: null,
    professorId: null,
    feedback: '',
    maintainedTime: '',
    completedDate: new Date().toISOString().split('T')[0],
  });
  const [showCompletionModal, setShowCompletionModal] = useState(false);
  const [performanceData, setPerformanceData] = useState<PerformanceData[]>([]);
  const [periodFilter, setPeriodFilter] = useState<PeriodFilter>('all');
  const [averageView, setAverageView] = useState<AverageView>('daily');
  const [customDateRange, setCustomDateRange] = useState({
    startDate: '',
    endDate: '',
  });
  const getTabDescription = (tab: 'trainings' | 'times' | 'performance' | 'checkin' | 'info'): string => {
    switch (tab) {
      case 'trainings':
        return 'Visualize e Acompanhe Seus Treinos da Semana.';
      case 'times':
        return 'Registre Seus Melhores Tempos de Campeonato ';
      case 'performance':
        return 'Acompanhe a Evolução do Seu Desempenho ao Longo do Tempo.';
      case 'checkin':
        return 'Faça Check-in nas Aulas Disponíveis Para Confirmar sua Presença.';
      case 'info':
        return 'Informações e Quadro de Avisos da APANAT.'
      default:
        return '';
    }
  };
  const [expandedClasses, setExpandedClasses] = useState<number[]>([]);
  const [studentType, setStudentType] = useState<'Mensalista' | 'Gympass' | 'Bolsista' | null>(null);
  const [showCheckinModal, setShowCheckinModal] = useState(false);
  const [selectedClassId, setSelectedClassId] = useState<number | null>(null);

  const toggleClassStudents = (classId: number) => {
    setExpandedClasses(prev => 
      prev.includes(classId) 
        ? prev.filter(id => id !== classId)
        : [...prev, classId]
    );
  };


  interface StudentNameProps {
    studentId: string;
  }
  
  function StudentName({ studentId }: StudentNameProps) {
    const [studentName, setStudentName] = useState<string | null>(null);
    
    // Cache para armazenar os nomes dos alunos
    const [cache, setCache] = useState<Record<string, string>>({});
  
    useEffect(() => {
      const fetchNames = async () => {
        // Se o nome do aluno já estiver no cache, apenas retorna ele
        if (cache[studentId]) {
          setStudentName(cache[studentId]);
          return;
        }
  
        // Caso contrário, faz a requisição
        const names = await fetchStudentNames([studentId]);
        const name = names[0]?.name || studentId;
  
        // Armazena o nome no cache
        setCache((prevCache) => ({ ...prevCache, [studentId]: name }));
        setStudentName(name);
      };
  
      fetchNames();
    }, [studentId, cache]); // Dependência de cache para atualizar quando necessário
  
    return <span>{studentName || 'Carregando...'}</span>;
  }

  const fetchStudentNames = async (studentIds: string[]) => {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, name')
      .in('id', studentIds);
  
    if (error) {
      console.error('Erro ao buscar nomes dos alunos:', error);
      return [];
    }
  
    return data;
  };

  const fetchClasses = async () => {
    const today = new Date();
    // Formatar a data para YYYY-MM-DD sem ajuste de timezone
    const formattedDate = today.getFullYear() + '-' + 
      String(today.getMonth() + 1).padStart(2, '0') + '-' + 
      String(today.getDate()).padStart(2, '0');
  
    console.log('Buscando aulas a partir de:', formattedDate);
  
    const { data, error } = await supabase
      .from('classes')
      .select(`
        *,
        class_checkins (
          id,
          student_id,
          checked_in_at
        ),
        professor:professor_id (
          name
        )
      `)
      .gte('date', formattedDate) // Busca aulas a partir de hoje
      .order('date', { ascending: true })
      .order('time', { ascending: true });
  
    if (error) {
      console.error('Erro ao buscar aulas:', error);
      return;
    }
  
    if (!data) {
      console.log('Nenhuma aula encontrada');
      setClasses([]);
      return;
    }
  
    const formattedData = data.map(classItem => ({
      ...classItem,
      class_checkins: classItem.class_checkins || []
    }));

    // Converter as datas para o formato local
    const formattedClasses = data.map(classItem => ({
      ...classItem,
      displayDate: new Date(classItem.date + 'T' + classItem.time)
    }));
  
    setClasses(formattedClasses);
    setClasses(formattedData);
  };

  useEffect(() => {
    const channel = supabase
      .channel('custom-checkin-channel-classcheckins')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'class_checkins' },
        (payload) => {
          console.log('Novo check-in detectado:', payload);
          fetchClasses(); // Atualiza a lista de aulas em tempo real
        }
      )
      .subscribe();
  
    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  useEffect(() => {
    const channel = supabase
      .channel('custom-update-channel-classes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'classes' },
        (payload) => {
          console.log('Mudança detectada:', payload);
          // Atualiza as aulas quando uma mudança é detectada
          fetchClasses();
        }
      )
      .subscribe();

    // Desinscreve o canal ao desmontar o componente
    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const saveLastSeenNoticeId = (noticeId: string) => {
    localStorage.setItem('lastSeenNoticeId', noticeId);
  };
  
  const getLastSeenNoticeId = () => {
    return localStorage.getItem('lastSeenNoticeId');
  };

  useEffect(() => {
    const channel = supabase
      .channel('custom-update-channel-trainings')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'trainings' },
        (payload) => {
          console.log('Mudança detectada:', payload);
          // Atualiza as aulas quando uma mudança é detectada
          fetchTrainings();
        }
      )
      .subscribe();

    // Desinscreve o canal ao desmontar o componente
    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  useEffect(() => {
    console.log("Setting up notices channel subscription");
  
    // Defina o canal
    const channel = supabase
      .channel("custom-notify-channel")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notices" },
        (payload) => {
          console.log("New notice received:", payload);
  
          if (payload.new) {
            console.log("New notice payload:", payload.new);
  
            // Atualiza o estado `notifications` com o novo aviso
            setNotifications(prev => [
              ...prev,
              {
                id: payload.new.id,
                message: payload.new.message,
                read: false,
              },
            ]);
  
            // Atualiza o estado `notices` com o novo aviso
            setNotices(prevNotices => [
              {
                message: payload.new.message,
                created_at: payload.new.created_at,
              },
              ...prevNotices, // Mantém os avisos antigos
            ]);
  
            // Garante que a notificação seja exibida sempre que um novo aviso for recebido
            setShowNotification(true);
            setLastNoticeId(payload.new.id);
          }
        }
      )
      .subscribe((status, err) => {
        if (status === 'SUBSCRIBED') {
          console.log("Successfully subscribed to notices channel");
        } else if (err) {
          console.error("Error subscribing to notices channel:", err);
        }
      });
  
    // Função de limpeza para remover o canal quando o componente for desmontado
    return () => {
      console.log("Cleaning up notices channel subscription");
      supabase.removeChannel(channel);
    };
  }, []); // O 
  
  
  
  // Add this new function to handle notification clicks
  const handleNotificationClick = () => {
    console.log("🔔 Clicando na notificação");
    setShowNotification(false);
    setActiveTab('info');
    
    // Salva o ID do último aviso visualizado
    if (lastNoticeId) {
      saveLastSeenNoticeId(lastNoticeId);
    }
  };

  // Add this somewhere before the return statement
  const handleCloseNotification = () => {
    console.log("🔔 Fechando notificação");
    setShowNotification(false);
  };
  
  // Add this inside your return statement, right after the opening <div className="min-h-screen...">
  {showNotification && (
    <>
      {console.log("🔔 Renderizando NotificationToast!")}
      <NotificationToast
        message="APANAT publicou um novo aviso!"
        onClose={handleCloseNotification}
        onClick={handleNotificationClick}
      />
    </>
  )}

  // Função de check-in
  const handleCheckin = async (classId: number) => {
    const existingCheckin = await supabase
      .from('class_checkins')
      .select('*')
      .eq('class_id', classId)
      .eq('student_id', user?.id)
      .single();

    if (existingCheckin.data) {
      alert('Você já fez check-in nesta aula!');
      return;
    }

    const { error } = await supabase
      .from('class_checkins')
      .insert([
        {
          class_id: classId,
          student_id: user?.id,
        },
      ]);

    if (error) {
      console.error('Erro ao fazer check-in:', error);
      alert('Erro ao fazer check-in');
    } else {
      alert('Check-in realizado com sucesso!');
      fetchClasses();
    }
  };

  const handleConfirmCheckin = async (classId: number) => {
    if (!studentType) {
      alert('Por favor, selecione o tipo de aluno.');
      return;
    }
  
    // Salvar o tipo de aluno no perfil do aluno
    const { error: profileError } = await supabase
      .from('profiles')
      .update({ student_type: studentType })
      .eq('id', user?.id);
  
    if (profileError) {
      console.error('Erro ao salvar tipo de aluno:', profileError);
      alert('Erro ao salvar tipo de aluno');
      return;
    }
  
    // Realizar o check-in normal
    const { error: checkinError } = await supabase
      .from('class_checkins')
      .insert([
        {
          class_id: classId, // Usa o classId passado como parâmetro
          student_id: user?.id,
        },
      ]);
  
    if (checkinError) {
      console.error('Erro ao fazer check-in:', checkinError);
      alert('Erro ao fazer check-in');
    } else {
      alert('Check-in realizado com sucesso!');
      fetchClasses();
    }
  
    // Fechar o modal
    setShowCheckinModal(false);
  };

  // Função para cancelar o check-in
  const handleCancelCheckin = async (classId: number) => {
    try {
      const confirmCancel = window.confirm('Tem certeza que deseja cancelar seu check-in?');
      
      if (!confirmCancel) {
        return;
      }
  
      const { error } = await supabase
        .from('class_checkins')
        .delete()
        .match({
          class_id: classId,
          student_id: user?.id
        });
  
      if (error) {
        console.error('Erro ao cancelar check-in:', error);
        alert('Erro ao cancelar check-in: ' + error.message);
        return;
      }
  
      console.log('Check-in cancelado com sucesso!');
      alert('Check-in cancelado com sucesso!');
      
      // Atualiza o estado local do aluno
      setClasses(prevClasses => 
        prevClasses.map(classItem => {
          if (classItem.id === classId) {
            return {
              ...classItem,
              class_checkins: classItem.class_checkins.filter(
                checkin => checkin.student_id !== user?.id
              )
            };
          }
          return classItem;
        })
      );
  
    } catch (err) {
      console.error('Erro inesperado ao cancelar check-in:', err);
      alert('Ocorreu um erro inesperado ao cancelar o check-in');
    }
  };

  useEffect(() => {
    localStorage.setItem('activeTab', activeTab);
  }, [activeTab]);

  // useEffect para carregar as aulas
  useEffect(() => {
    if (user) {
      fetchClasses();
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      fetchTrainings();
      fetchPerformanceData();
      fetchClasses();
    }
  }, [user]);

  useEffect(() => {
    const checkAuthorization = async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('is_authorized')
        .eq('id', user?.id)
        .single();

      if (error) {
        console.error('Erro ao verificar autorização:', error);
        return;
      }

      setIsAuthorized(data?.is_authorized || false);
      setLoading(false);

      if (data?.is_authorized) {
        fetchTrainings();
        fetchPerformanceData();
      }
    };

    checkAuthorization();
  }, [user]);

  const fetchTrainings = async () => {
    const { data, error } = await supabase
      .from('trainings')
      .select('*')
      .order('date', { ascending: true });

    if (error) {
      console.error('Erro ao buscar treinos:', error);
    } else {
      setTrainings(data as Training[]);
    }
  };

  const convertTimeStringToSeconds = (timeString: string) => {
    if (!timeString) {
      return { seconds: 0, displayTime: '0:00' };
    }

    try {
      if (timeString.includes(':')) {
        const [minutes, seconds] = timeString.split(':').map(Number);
        const totalSeconds = minutes * 60 + seconds;
        return {
          seconds: totalSeconds,
          displayTime: timeString,
        };
      }
      return { seconds: 0, displayTime: '0:00' };
    } catch (error) {
      console.error('Erro ao converter tempo:', error);
      return { seconds: 0, displayTime: '0:00' };
    }
  };

  const fetchPerformanceData = async () => {
    const { data, error } = await supabase
      .from('attendances')
      .select(
        `completed_at,
        maintained_time`
      )
      .eq('student_id', user?.id)
      .not('maintained_time', 'is', null)
      .order('completed_at', { ascending: true });

    if (error) {
      console.error('Erro ao buscar dados de desempenho:', error);
      return;
    }

    if (data) {
      const formattedData = data
        .filter((record) => record.maintained_time)
        .map((record) => {
          const time = convertTimeStringToSeconds(record.maintained_time || '0');
          const utcDate = new Date(record.completed_at);
          const localDate = new Date(utcDate.getTime() + utcDate.getTimezoneOffset() * 60000);
          const formattedDate = localDate.toLocaleDateString('pt-BR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
          });

          return {
            date: formattedDate,
            seconds: time.seconds,
            displayTime: time.displayTime,
          };
        });

      formattedData.sort((a, b) => {
        const dateA = new Date(a.date.split('/').reverse().join('-'));
        const dateB = new Date(b.date.split('/').reverse().join('-'));
        return dateA.getTime() - dateB.getTime();
      });

      setPerformanceData(formattedData);
    }
  };

  const [notices, setNotices] = useState<Notice[]>([]);
  // Função para buscar avisos
  const fetchNotices = async () => {
    const { data, error } = await supabase
      .from('notices')
      .select('id, message, created_at')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Erro ao buscar avisos:', error);
    } else if (data) {
      setNotices(data); // Atualiza o estado com os avisos buscados

      // Verifica se há um novo aviso
      if (data.length > 0) {
        const lastNotice = data[0]; // Último aviso publicado
        const lastSeenNoticeId = getLastSeenNoticeId();

        if (lastSeenNoticeId !== lastNotice.id) {
          // Se o último aviso visualizado for diferente do último aviso publicado, mostre a notificação
          setShowNotification(true);
          setLastNoticeId(lastNotice.id);
        }
      }
    }
  };

  // Busca os avisos assim que o componente é montado
  useEffect(() => {
    fetchNotices();
  }, []);

  // Atualiza o último aviso visualizado quando o aluno acessa a aba de informações
  useEffect(() => {
    if (lastNoticeId) {
      saveLastSeenNoticeId(lastNoticeId);
    }
  }, [lastNoticeId]);

  const InfoTab = () => {
    
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Seção de Avisos */}
          <div className="rounded-lg bg-gradient-to-br from-blue-50 to-white p-6 shadow-md">
              <div className="mb-6">
                  <h2 className="flex items-center gap-2 text-2xl font-bold text-blue-600">
                      <Bell className="h-6 w-6" />
                      Quadro de Avisos
                  </h2>
              </div>

              <div className="space-y-4">
                  {notices.length > 0 ? (
                      notices.map((notice, index) => (
                          <div
                              key={index}
                              className="p-6 rounded-lg bg-white shadow-sm border-l-4 border-blue-500 transition-all hover:shadow-md"
                          >
                              <p className="text-gray-800">{notice.message}</p>
                              <p className="text-sm text-gray-500 mt-2">
                                  {new Date(notice.created_at).toLocaleDateString('pt-BR', {
                                      day: '2-digit',
                                      month: 'long',
                                      year: 'numeric'
                                  })}
                              </p>
                          </div>
                      ))
                  ) : (
                      <div className="text-center py-12">
                          <Bell className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                          <p className="text-gray-600">Nenhum aviso no momento.</p>
                      </div>
                  )}
              </div>
          </div>

          {/* Seção de Informações */}
          <div className="rounded-lg bg-gradient-to-br from-blue-50 to-white p-6 shadow-md mt-8">
              <div className="mb-6">
                  <h2 className="flex items-center gap-2 text-2xl font-bold text-blue-600">
                      <Info className="h-6 w-6" />
                      Informações da Apanat
                  </h2>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="flex items-center gap-3 p-4 rounded-lg bg-white shadow-sm transition-all hover:shadow-md">
                      <div className="bg-blue-100 p-3 rounded-full shrink-0">
                          <Phone className="h-6 w-6 text-blue-600" />
                      </div>
                      <div>
                          <p className="text-sm text-gray-500">Contato</p>
                          <p className="font-medium">(63) 99215-6443</p>
                      </div>
                  </div>

                  <div className="flex items-start gap-3 p-4 rounded-lg bg-white shadow-sm transition-all hover:shadow-md">
                      <div className="bg-blue-100 p-3 rounded-full shrink-0">
                          <Mail className="h-6 w-6 text-blue-600" />
                      </div>
                      <div className="min-w-0">
                          <p className="text-sm text-gray-500">Email</p>
                          <p className="font-medium break-words">clubeapanat@gmail.com</p>
                      </div>
                  </div>

                  <div className="flex items-start gap-3 p-4 rounded-lg bg-white shadow-sm transition-all hover:shadow-md">
                      <div className="bg-blue-100 p-3 rounded-full shrink-0">
                          <MapPin className="h-6 w-6 text-blue-600" />
                      </div>
                      <div>
                          <p className="text-sm text-gray-500">Endereço</p>
                          <p className="font-medium">206 Norte, Piscina Colégio Militar</p>
                          <p className="text-sm text-gray-500">Palmas, TO - 77006244</p>
                      </div>
                  </div>
              </div>

              {/* WhatsApp Link - Separado do grid principal */}
              <div className="mt-6">
                  <a 
                      href="https://chat.whatsapp.com/GHrM0M9WUWFH3CYAqU9Zwe" 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="flex items-center justify-center gap-2 w-full bg-blue-500 text-white p-3 rounded-lg hover:bg-blue-600 transition-colors"
                  >
                      <svg className="h-6 w-6" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                      </svg>
                      Participe do nosso grupo no WhatsApp
                  </a>
              </div>
          </div>
      </div>
  );
};

  const groupTrainingsByWeek = (trainings: Training[]) => {
    const grouped: Record<string, Training[]> = {};

    trainings.forEach((training) => {
      const date = new Date(training.date);
      const startOfWeek = new Date(date);
      startOfWeek.setDate(date.getDate() - date.getDay() + 1);
      const endOfWeek = new Date(startOfWeek);
      endOfWeek.setDate(startOfWeek.getDate() + 5);

      const weekKey = `${startOfWeek.toLocaleDateString()} - ${endOfWeek.toLocaleDateString()}`;

      if (!grouped[weekKey]) {
        grouped[weekKey] = [];
      }
      grouped[weekKey].push(training);
    });

    return grouped;
  };

  const toggleWeek = (weekKey: string) => {
    if (expandedWeeks.includes(weekKey)) {
      setExpandedWeeks(expandedWeeks.filter((key) => key !== weekKey));
    } else {
      setExpandedWeeks([...expandedWeeks, weekKey]);
    }
  };

  const openCompletionModal = (trainingId: number, professorId: string) => {
    setCompletionForm({
      trainingId,
      professorId,
      feedback: '',
      maintainedTime: '',
      completedDate: new Date().toISOString().split('T')[0],
    });
    setShowCompletionModal(true);
  };

  const handleCompleteTraining = async () => {
    if (!completionForm.trainingId || !completionForm.professorId) return;

    if (completionForm.maintainedTime && !completionForm.maintainedTime.match(/^\d{1,2}:\d{2}$/)) {
      alert('Por favor, insira o tempo no formato correto (ex: 1:30)');
      return;
    }

    // Ajusta a data para meio-dia do dia selecionado
    const selectedDate = new Date(completionForm.completedDate + 'T12:00:00');

    const { error } = await supabase
      .from('attendances')
      .insert([
        {
          training_id: completionForm.trainingId,
          student_id: user?.id,
          professor_id: completionForm.professorId,
          completed_at: selectedDate.toISOString(),
          feedback: completionForm.feedback || null,
          maintained_time: completionForm.maintainedTime || null,
        },
      ]);

    if (error) {
      console.error('Erro ao marcar treino como concluído:', error);
      alert('Erro ao marcar treino como concluído');
    } else {
      alert('Treino marcado como concluído!');
      setShowCompletionModal(false);
      fetchPerformanceData();
    }
  };

  const formatSecondsToTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const calculateAverages = (data: PerformanceData[], view: AverageView) => {
    if (data.length === 0) return [];

    const groupedData: Record<string, number[]> = {};

    data.forEach((item) => {
      const date = new Date(item.date.split('/').reverse().join('-'));
      let key: string;

      if (view === 'weekly') {
        const firstDay = new Date(date);
        firstDay.setDate(date.getDate() - date.getDay() + 1);
        key = firstDay.toLocaleDateString('pt-BR');
      } else if (view === 'monthly') {
        key = `${date.getMonth() + 1}/${date.getFullYear()}`;
      } else {
        key = item.date;
      }

      if (!groupedData[key]) {
        groupedData[key] = [];
      }
      groupedData[key].push(item.seconds);
    });

    return Object.entries(groupedData).map(([date, values]) => ({
      date,
      seconds: Math.round(values.reduce((a, b) => a + b, 0) / values.length),
      displayTime: formatSecondsToTime(Math.round(values.reduce((a, b) => a + b, 0) / values.length)),
    }));
  };

  const filterDataByPeriod = (data: PerformanceData[], filter: PeriodFilter) => {
    const today = new Date();
    const filteredData = data.filter((item) => {
      const itemDate = new Date(item.date.split('/').reverse().join('-'));

      switch (filter) {
        case 'week':
          const lastWeek = new Date(today);
          lastWeek.setDate(today.getDate() - 7);
          return itemDate >= lastWeek;
        case 'month':
          const lastMonth = new Date(today);
          lastMonth.setMonth(today.getMonth() - 1);
          return itemDate >= lastMonth;
        case 'custom':
          const start = customDateRange.startDate ? new Date(customDateRange.startDate) : new Date(0);
          const end = customDateRange.endDate ? new Date(customDateRange.endDate) : new Date();
          return itemDate >= start && itemDate <= end;
        default:
          return true;
      }
    });

    return calculateAverages(filteredData, averageView);
  };

  const groupedTrainings = groupTrainingsByWeek(trainings);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500" />
      </div>
    );
  }

  if (!isAuthorized) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
        <div className="bg-white p-6 sm:p-8 rounded-lg shadow-xl max-w-md w-full text-center">
          <div className="mb-6">
            <svg
              className="w-16 h-16 text-yellow-500 mx-auto"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-gray-800 mb-4">Aguardando Autorização</h2>
          <p className="text-gray-600 mb-6">
            Sua conta está aguardando autorização do professor. Você será notificado quando sua conta for aprovada.
          </p>
          <div className="p-4 bg-yellow-50 rounded-lg">
            <p className="text-sm text-yellow-700">
              Por favor, aguarde o professor autorizar seu acesso aos treinos.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
    {showNotification && (
      <NotificationToast
        message="APANAT publicou um novo aviso!"
        onClose={handleCloseNotification}
        onClick={handleNotificationClick}
      />
    )}
  
      {/* Abas de navegação */}
      <div className="bg-white shadow-lg mb-8 border-0">
        <nav className="flex space-x-1 p-2 overflow-x-auto md:overflow-x-visible whitespace-nowrap border-0">
          <button
            onClick={() => setActiveTab('trainings')}
            className={`flex-1 flex items-center justify-center px-4 py-3 rounded-lg text-sm font-medium transition-all duration-200 ${
              activeTab === 'trainings'
                ? 'bg-blue-500 text-white shadow-md'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            <Timer className="w-5 h-5 mr-2" />
            Treinos
          </button>
          <button
            onClick={() => setActiveTab('checkin')}
            className={`flex-1 flex items-center justify-center px-4 py-3 rounded-lg text-sm font-medium transition-all duration-200 ${
              activeTab === 'checkin'
                ? 'bg-blue-500 text-white shadow-md'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            <Calendar className="w-5 h-5 mr-2" />
            Check-in
          </button>
          <button
            onClick={() => setActiveTab('times')}
            className={`flex-1 flex items-center justify-center px-4 py-3 rounded-lg text-sm font-medium transition-all duration-200 ${
              activeTab === 'times'
                ? 'bg-blue-500 text-white shadow-md'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            <Activity className="w-5 h-5 mr-2" />
            Meus Tempos
          </button>
          <button
            onClick={() => setActiveTab('performance')}
            className={`flex-1 flex items-center justify-center px-4 py-3 rounded-lg text-sm font-medium transition-all duration-200 ${
              activeTab === 'performance'
                ? 'bg-blue-500 text-white shadow-md'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            <Award className="w-5 h-5 mr-2" />
            Desempenho
          </button>
          <button
            onClick={() => setActiveTab('info')}
            className={`flex-1 flex items-center justify-center px-4 py-3 rounded-lg text-sm font-medium transition-all duration-200 ${
                activeTab === 'info'
                    ? 'bg-blue-500 text-white shadow-md'
                    : 'text-gray-600 hover:bg-gray-100'
            }`}
        >
            <Info className="w-5 h-5 mr-2" /> {/* Adicione o ícone de informações */}
            Informações
        </button>
        </nav>
      </div>
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 mb-8">
          <p className="text-gray-600 text-center">{getTabDescription(activeTab)}</p>
      </div>

      {activeTab === 'trainings' && (
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl font-bold mb-6 text-gray-800">Treinos da Semana</h2>
          <div className="space-y-4">
            {Object.entries(groupedTrainings).map(([weekKey, weekTrainings]) => (
              <div key={weekKey} className="bg-white p-4 rounded-lg shadow-md">
                <button
                  onClick={() => toggleWeek(weekKey)}
                  className="w-full text-left flex justify-between items-center p-2 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  <span className="font-semibold text-blue-600">{weekKey}</span>
                  <span>{expandedWeeks.includes(weekKey) ? '▲' : '▼'}</span>
                </button>
                {expandedWeeks.includes(weekKey) && (
                  <div className="mt-4 space-y-4">
                    {weekTrainings.map((training) => (
                      <div
                        key={training.id}
                        className="p-4 border rounded-lg hover:shadow-lg transition-shadow"
                      >
                        <h3 className="text-xl font-bold text-blue-600 mb-2">{training.title}</h3>
                        <p className="text-gray-600 mb-4 whitespace-pre-line">{training.description}</p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm text-gray-700">
                          <div>
                            <span className="font-semibold">Data:</span> {new Date(training.date).toLocaleDateString()}
                          </div>
                          <div>
                            <span className="font-semibold">Duração:</span> {training.duration} minutos
                          </div>
                          <div>
                            <span className="font-semibold">Dificuldade:</span> {training.difficulty}
                          </div>
                        </div>
                        <button
                          onClick={() => openCompletionModal(training.id, training.professor_id)}
                          className="mt-4 w-full sm:w-auto bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 transition-colors"
                        >
                          Marcar como Concluído
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'times' && (
        <div className="max-w-4xl mx-auto">
          <MyTimes />
        </div>
      )}

{activeTab === 'performance' && (
  <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
    <h2 className="text-2xl font-bold mb-6 text-gray-800">Evolução do Desempenho</h2>
    
    {/* Controles de filtro */}
    <div className="bg-white p-4 rounded-lg shadow-md mb-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Filtro de Período */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Período
          </label>
          <select
            value={periodFilter}
            onChange={(e) => setPeriodFilter(e.target.value as PeriodFilter)}
            className="w-full p-2 text-sm border rounded-lg focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">Todos</option>
            <option value="week">Última Semana</option>
            <option value="month">Último Mês</option>
            <option value="custom">Personalizado</option>
          </select>
        </div>

        {/* Seletor de Média */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Visualização
          </label>
          <select
            value={averageView}
            onChange={(e) => setAverageView(e.target.value as AverageView)}
            className="w-full p-2 text-sm border rounded-lg focus:ring-2 focus:ring-blue-500"
          >
            <option value="daily">Diária</option>
            <option value="weekly">Média Semanal</option>
            <option value="monthly">Média Mensal</option>
          </select>
        </div>
      </div>

      {/* Datas personalizadas */}
      {periodFilter === 'custom' && (
        <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Data Inicial
            </label>
            <input
              type="date"
              value={customDateRange.startDate}
              onChange={(e) => setCustomDateRange(prev => ({
                ...prev,
                startDate: e.target.value
              }))}
              className="w-full p-2 text-sm border rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Data Final
            </label>
            <input
              type="date"
              value={customDateRange.endDate}
              onChange={(e) => setCustomDateRange(prev => ({
                ...prev,
                endDate: e.target.value
              }))}
              className="w-full p-2 text-sm border rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
      )}
    </div>

    {/* Gráfico */}
    {performanceData.length > 0 ? (
      <div className="w-full bg-white p-4 rounded-lg shadow-md">
        {/* Altura ajustável para diferentes tamanhos de tela */}
        <div className="h-[300px] sm:h-[400px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={filterDataByPeriod(performanceData, periodFilter)}
              margin={{
                top: 5,
                right: 5, // Reduzido para mobile
                left: 0,  // Reduzido para mobile
                bottom: 40, // Reduzido para mobile
              }}
            >
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                dataKey="date"
                interval={'preserveStartEnd'}  // Mostra primeiro e último
                angle={-45}
                textAnchor="end"
                height={50}
                tick={{
                  fontSize: 10, // Fonte menor para mobile
                  dy: 10
                }}
                tickFormatter={(value) => {
                  // Formato mais curto para datas em mobile
                  const [day, month, year] = value.split('/');
                  return window.innerWidth < 640 ? `${day}/${month}` : value;
                }}
              />
              <YAxis
                reversed={true}
                domain={[60, 120]}
                ticks={[60, 70, 80, 90, 100, 110, 120]}
                label={{
                  value: 'Tempo',
                  angle: -90,
                  position: 'insideLeft',
                  offset: -20,
                  fontSize: 12 // Fonte menor para mobile
                }}
                tick={{
                  fontSize: 10 // Fonte menor para mobile
                }}
                tickFormatter={(value) => {
                  const minutes = Math.floor(value / 60);
                  const seconds = value % 60;
                  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
                }}
                width={40} // Largura fixa para o eixo Y
              />
              <Tooltip
                formatter={(value: number) => {
                  const minutes = Math.floor(value / 60);
                  const seconds = value % 60;
                  return [`${minutes}:${seconds.toString().padStart(2, '0')}`, 'Tempo mantido'];
                }}
                contentStyle={{
                  fontSize: '12px' // Fonte menor para o tooltip
                }}
              />
              <Legend
                wrapperStyle={{
                  fontSize: '12px', // Fonte menor para a legenda
                  paddingTop: '10px'
                }}
              />
              <Line
                type="monotone"
                dataKey="seconds"
                stroke="#2563eb"
                name="Tempo mantido"
                strokeWidth={2}
                dot={{
                  r: 4, // Pontos menores em mobile
                  fill: '#2563eb',
                  strokeWidth: 2
                }}
                activeDot={{
                  r: 6, // Pontos ativos menores em mobile
                  fill: '#1e40af',
                  strokeWidth: 2
                }}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    ) : (
      <div className="bg-white p-6 rounded-lg shadow-md text-center">
        <p className="text-gray-600">
          Ainda não há dados de desempenho registrados.
          Complete alguns treinos e registre seus tempos para ver sua evolução!
        </p>
      </div>
    )}
    
    {/* Tabela de dados - Também ajustada para mobile */}
    <div className="mt-4 bg-white p-4 rounded-lg shadow-md overflow-x-auto">
      <h3 className="text-lg font-semibold mb-2">Dados do Gráfico:</h3>
      <table className="w-full min-w-[300px]">
        <thead>
          <tr>
            <th className="text-left px-2 py-1 text-sm sm:text-base">Data</th>
            <th className="text-left px-2 py-1 text-sm sm:text-base">Tempo</th>
          </tr>
        </thead>
        <tbody>
          {filterDataByPeriod(performanceData, periodFilter).map((item, index) => (
            <tr key={index} className={index % 2 === 0 ? 'bg-gray-50' : ''}>
              <td className="px-2 py-1 text-sm sm:text-base">{item.date}</td>
              <td className="px-2 py-1 text-sm sm:text-base">{item.displayTime}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </div>
)}

      {/* Modal de Conclusão do Treino */}
      {showCompletionModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white p-6 rounded-lg shadow-md w-full max-w-md">
            <h2 className="text-2xl font-bold mb-4 text-gray-800">Concluir Treino</h2>
            
            {/* Campo de data */}
            <div className="mb-4">
              <label className="block text-gray-700 font-medium mb-2">
                Data de conclusão
              </label>
              <input
                type="date"
                value={completionForm.completedDate}
                onChange={(e) => setCompletionForm({
                  ...completionForm,
                  completedDate: e.target.value
                })}
                className="w-full p-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Resto dos campos existentes */}
            <div className="mb-4">
              <label className="block text-gray-700 font-medium mb-2">
                Como foi o treino? (opcional)
              </label>
              <textarea
                value={completionForm.feedback}
                onChange={(e) => setCompletionForm({
                  ...completionForm,
                  feedback: e.target.value
                })}
                className="w-full p-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Compartilhe sua experiência com o treino..."
                rows={4}
              />
            </div>

            {/* Campo de tempo mantido */}
            <div className="mb-4">
              <label className="block text-gray-700 font-medium mb-2">
                Quanto manteve na série? (formato: mm:ss)
              </label>
              <input
                type="text"
                value={completionForm.maintainedTime}
                onChange={(e) => {
                  let value = e.target.value;
                  value = value.replace(/[^\d:]/g, '');
                  if (!value.includes(':')) {
                    if (value.length >= 2) {
                      value = `${value.slice(0, 2)}:${value.slice(2, 4)}`;
                    }
                  }
                  const [min, sec] = value.split(':');
                  if (sec && parseInt(sec) > 59) {
                    value = `${min}:59`;
                  }
                  setCompletionForm({
                    ...completionForm,
                    maintainedTime: value
                  });
                }}
                className="w-full p-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Ex: 1:30 (1 minuto e 30 segundos)"
                pattern="[0-9]{1,2}:[0-9]{2}"
                maxLength={5}
              />
            </div>

            {/* Botões */}
            <div className="flex justify-end space-x-2">
              <button
                onClick={() => setShowCompletionModal(false)}
                className="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleCompleteTraining}
                className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors"
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}
      
      {activeTab === 'checkin' && (
        <div className="space-y-6 px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-gray-800 flex items-center">
              <Calendar className="w-6 h-6 mr-2 text-blue-500" />
              Aulas Disponíveis
            </h2>
          </div>

          <div className="grid gap-6">
          {classes.map((class_) => {
              const [year, month, day] = class_.date.split('-').map(Number);
              const [hours, minutes] = class_.time.split(':').map(Number);
              const classDate = new Date(year, month - 1, day, hours, minutes);
              const now = new Date();
              const oneHourBefore = new Date(classDate);
              oneHourBefore.setHours(oneHourBefore.getHours() - 1);
              const classEndTime = new Date(classDate);
              classEndTime.setMinutes(classEndTime.getMinutes() + class_.duration);

              const isActive = now >= oneHourBefore && now <= classEndTime;
              const hasCheckedIn = class_.class_checkins?.some(
                checkin => checkin.student_id === user?.id
              );
              const isFull = class_.class_checkins?.length >= class_.max_students;
              const isCancelled = class_.status === 'cancelled';
              const isExpanded = expandedClasses.includes(class_.id);

              return (
                <div
                  key={class_.id}
                  className={`bg-gradient-to-br ${
                    isCancelled
                      ? 'from-red-50 to-red-100 border-2 border-red-300'
                      : 'from-white to-gray-50'
                  } rounded-xl shadow-md transition-all duration-300 hover:shadow-lg ${
                    isActive && !isCancelled ? 'ring-2 ring-blue-500' : ''
                  }`}
                >
                  <div className="p-4 sm:p-6">
                    <div className="flex justify-between items-start">
                      <div className="space-y-2 sm:space-y-3">
                        <h3 className="text-xl font-bold text-gray-900">{class_.title}</h3>
                        <div className="space-y-1 sm:space-y-2">
                          <p className="flex items-center text-gray-600">
                            <Calendar className="w-4 h-4 mr-2" />
                            {classDate.toLocaleDateString()}
                          </p>
                          <p className="flex items-center text-gray-600">
                            <Clock className="w-4 h-4 mr-2" />
                            {classDate.toLocaleTimeString([], { 
                              hour: '2-digit', 
                              minute: '2-digit' 
                            })}
                          </p>
                          <p className="flex items-center text-gray-600">
                            <Timer className="w-4 h-4 mr-2" />
                            {class_.duration} minutos
                          </p>
                          <button
                              onClick={() => toggleClassStudents(class_.id)}
                              className="flex items-center text-gray-600 hover:text-gray-900 transition-colors"
                            >
                              <Users className="w-4 h-4 mr-2" />
                              {class_.class_checkins?.length || 0}/{class_.max_students} vagas
                              {isExpanded ? (
                                <ChevronUp className="w-4 h-4 ml-1" />
                              ) : (
                                <ChevronDown className="w-4 h-4 ml-1" />
                              )}
                            </button>
                            {isExpanded && (
                              <div className="mt-2 pl-6 space-y-1">
                              <ul className="list-disc list-inside">
                                {class_.class_checkins.map((checkin, index) => (
                                  <li key={index} className="text-gray-600">
                                    <StudentName studentId={checkin.student_id} />
                                  </li>
                                ))}
                              </ul>
                            </div>
                            )}
                        </div>
                      </div>

                      <div className="flex flex-col items-end space-y-2 sm:space-y-3">
                        <span
                          className={`px-4 py-2 rounded-full text-sm font-medium ${
                            isCancelled
                              ? 'bg-red-100 text-red-800'
                              : isActive
                              ? 'bg-green-100 text-green-800'
                              : now > classEndTime
                              ? 'bg-gray-100 text-gray-800'
                              : now < oneHourBefore
                              ? 'bg-yellow-100 text-yellow-800'
                              : 'bg-blue-100 text-blue-800'
                          }`}
                        >
                          {isCancelled 
                            ? 'Aula Cancelada'
                            : isActive 
                            ? 'Check-in Disponível' 
                            : now > classEndTime
                            ? 'Encerrada'
                            : now < oneHourBefore
                            ? 'Em breve'
                            : 'Agendada'}
                        </span>

                        {hasCheckedIn ? (
                          <div className="flex flex-col items-end space-y-2">
                            <div className="flex items-center text-green-600">
                            <CheckCircle className="w-4 h-4 sm:w-5 sm:h-5 mr-1" />
                              <span className="text-sm sm:text-base font-medium">Check-in realizado</span>
                            </div>
                            {/* Botão de Cancelar Check-in */}
                            {now <= classEndTime && !isCancelled && (
                              <button
                                onClick={() => handleCancelCheckin(class_.id)}
                                className="px-3 py-1.5 sm:px-4 sm:py-2 text-sm rounded-lg text-white font-medium bg-red-500 hover:bg-red-600 transition-all duration-200 shadow-md hover:shadow-lg transform hover:-translate-y-0.5"
                              >
                                Cancelar Check-in
                              </button>
                            )}
                          </div>
                        ) : (
                        <button
                          onClick={() => {
                            setSelectedClassId(class_.id); // Armazena o classId da aula
                            setShowCheckinModal(true); // Abre o modal de seleção do tipo de aluno
                          }}
                          disabled={!isActive || isFull || now > classEndTime || isCancelled}
                          className={`px-3 py-1.5 sm:px-4 sm:py-2 text-sm rounded-lg text-white font-medium transition-all duration-200 ${
                            isActive && !isFull && !isCancelled && now <= classEndTime
                              ? 'bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 shadow-md hover:shadow-lg transform hover:-translate-y-0.5'
                              : 'bg-gray-400 cursor-not-allowed'
                          }`}
                        >
                          {isCancelled
                            ? 'Aula cancelada'
                            : isFull 
                            ? 'Aula lotada' 
                            : now > classEndTime
                            ? 'Aula encerrada'
                            : !isActive 
                            ? 'Aguardando' 
                            : 'Fazer Check-in'}
                        </button>
                        )}
                      </div>
                    </div>

                    {hasCheckedIn && !isCancelled && (
                      <div className="mt-4 p-4 bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg border border-green-100">
                        <p className="text-green-700 flex items-center">
                          <CheckCircle className="w-5 h-5 mr-2" />
                          Presença confirmada! Não se esqueça do horário da aula.
                        </p>
                      </div>
                    )}

                    {isCancelled && (
                      <div className="mt-4 p-4 bg-red-50 rounded-lg border border-red-200">
                        <p className="text-red-700 flex items-center">
                          <AlertTriangle className="w-5 h-5 mr-2" />
                          Esta aula foi cancelada. Entre em contato com o professor para mais informações.
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}

            {classes.length === 0 && (
              <div className="text-center py-12 bg-gray-50 rounded-xl">
                <Calendar className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600">
                  Nenhuma aula disponível no momento.
                </p>
              </div>
            )}
          </div>
        </div>
      )}
      {activeTab === 'info' && <InfoTab />}

      {/* Modal de seleção do tipo de aluno */}
      {showCheckinModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white p-6 rounded-lg shadow-md w-full max-w-md">
            <h2 className="text-2xl font-bold mb-4 text-gray-800">Você é aluno:</h2>
            <div className="space-y-4">
              <button
                onClick={() => setStudentType('Mensalista')}
                className={`w-full p-3 rounded-lg text-left ${studentType === 'Mensalista' ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-700'}`}
              >
                Mensalista
              </button>
              <button
                onClick={() => setStudentType('Gympass')}
                className={`w-full p-3 rounded-lg text-left ${studentType === 'Gympass' ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-700'}`}
              >
                Gympass
              </button>
              <button
                onClick={() => setStudentType('Bolsista')}
                className={`w-full p-3 rounded-lg text-left ${studentType === 'Bolsista' ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-700'}`}
              >
                Bolsista
              </button>
            </div>
            <div className="mt-6 flex justify-end space-x-2">
              <button
                onClick={() => setShowCheckinModal(false)}
                className="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={() => handleConfirmCheckin(selectedClassId!)}
                className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors"
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}