import React, { useState, useEffect } from 'react';
import { useAuthStore } from '../store/authStore';
import { supabase } from '../lib/supabase';
import MyTimes from '../components/MyTimes';
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
  created_at: string;
  professor: {
    name: string;
  };
  class_checkins: {
    student_id: string;
  }[];
}

type PeriodFilter = 'all' | 'week' | 'month' | 'custom';
type AverageView = 'daily' | 'weekly' | 'monthly';
type ActiveTab = 'trainings' | 'times' | 'performance' | 'checkin';

export default function AlunoDashboard() {
  const { user } = useAuthStore();
  const [trainings, setTrainings] = useState<Training[]>([]);
  const [expandedWeeks, setExpandedWeeks] = useState<string[]>([]);
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<ActiveTab>('trainings');
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

  const fetchClasses = async () => {
    const today = new Date();
    const formattedDate = today.toISOString().split('T')[0];

    const { data, error } = await supabase
      .from('classes')
      .select(
        `*,
        class_checkins (
          id,
          student_id,
          checked_in_at
        )`
      )
      .gte('date', formattedDate)
      .order('date', { ascending: true })
      .order('time', { ascending: true });

    if (error) {
      console.error('Erro ao buscar aulas:', error);
      return;
    } else {
      setClasses(data as Class[]);
    }
  };

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

    const selectedDate = new Date(completionForm.completedDate);
    selectedDate.setHours(0, 0, 0, 0);

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
    <div className="p-4 sm:p-6 bg-gray-50 min-h-screen">
      <h1 className="text-2xl sm:text-3xl font-bold text-center mb-6 text-blue-600">Área do Aluno</h1>

      {/* Abas de navegação */}
      <div className="max-w-7xl mx-auto mb-6">
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex space-x-4 sm:space-x-8 overflow-x-auto whitespace-nowrap">
            <button
              onClick={() => setActiveTab('trainings')}
              className={`${
                activeTab === 'trainings'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              } whitespace-nowrap py-2 sm:py-4 px-1 border-b-2 font-medium text-sm`}
            >
              Treinos
            </button>
            <button
              onClick={() => setActiveTab('times')}
              className={`${
                activeTab === 'times'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              } whitespace-nowrap py-2 sm:py-4 px-1 border-b-2 font-medium text-sm`}
            >
              Melhores Tempos
            </button>
            <button
              onClick={() => setActiveTab('performance')}
              className={`${
                activeTab === 'performance'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              } whitespace-nowrap py-2 sm:py-4 px-1 border-b-2 font-medium text-sm`}
            >
              Desempenho
            </button>
            <button
              onClick={() => setActiveTab('checkin')}
              className={`${
                activeTab === 'checkin'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              } whitespace-nowrap py-2 sm:py-4 px-1 border-b-2 font-medium text-sm`}
            >
              Check-in
            </button>
          </nav>
        </div>
      </div>

      {activeTab === 'trainings' && (
        <div className="max-w-4xl mx-auto">
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
                          className="mt-4 w-full sm:w-auto bg-green-500 text-white px-4 py-2 rounded-lg hover:bg-green-600 transition-colors"
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
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl font-bold mb-6 text-gray-800">Evolução do Desempenho</h2>
          
          {/* Controles de filtro */}
          <div className="bg-white p-2 sm:p-4 rounded-lg shadow-md mb-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 sm:gap-4">
              {/* Filtro de Período */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1 sm:mb-2">
                  Período
                </label>
                <select
                  value={periodFilter}
                  onChange={(e) => setPeriodFilter(e.target.value as PeriodFilter)}
                  className="w-full p-1 sm:p-2 text-sm border rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="all">Todos</option>
                  <option value="week">Última Semana</option>
                  <option value="month">Último Mês</option>
                  <option value="custom">Personalizado</option>
                </select>
              </div>

              {/* Seletor de Média */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1 sm:mb-2">
                  Visualização
                </label>
                <select
                  value={averageView}
                  onChange={(e) => setAverageView(e.target.value as AverageView)}
                  className="w-full p-1 sm:p-2 text-sm border rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="daily">Diária</option>
                  <option value="weekly">Média Semanal</option>
                  <option value="monthly">Média Mensal</option>
                </select>
              </div>
            </div>

            {/* Datas personalizadas */}
            {periodFilter === 'custom' && (
              <div className="mt-2 sm:mt-4 grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1 sm:mb-2">
                    Data Inicial
                  </label>
                  <input
                    type="date"
                    value={customDateRange.startDate}
                    onChange={(e) => setCustomDateRange(prev => ({
                      ...prev,
                      startDate: e.target.value
                    }))}
                    className="w-full p-1 sm:p-2 text-sm border rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1 sm:mb-2">
                    Data Final
                  </label>
                  <input
                    type="date"
                    value={customDateRange.endDate}
                    onChange={(e) => setCustomDateRange(prev => ({
                      ...prev,
                      endDate: e.target.value
                    }))}
                    className="w-full p-1 sm:p-2 text-sm border rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Gráfico */}
          {performanceData.length > 0 ? (
            <div className="w-full bg-white p-2 sm:p-4 rounded-lg shadow-md">
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
          <div className="mt-4 bg-white p-2 sm:p-4 rounded-lg shadow-md overflow-x-auto">
            <h3 className="text-lg font-semibold mb-2 px-2">Dados do Gráfico:</h3>
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
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl font-bold mb-6 text-gray-800">Aulas Disponíveis</h2>
          <div className="space-y-4">
            {classes.map((class_) => {
              const classDate = new Date(`${class_.date}T${class_.time}`);
              const now = new Date();
              const isActive = now >= new Date(classDate.getTime() - 60 * 60 * 1000) && 
                            now <= new Date(classDate.getTime() + class_.duration * 60 * 1000);
              const hasCheckedIn = class_.class_checkins?.some(
                checkin => checkin.student_id === user?.id
              );
              const isFull = class_.class_checkins?.length >= class_.max_students;

              return (
                <div
                  key={class_.id}
                  className={`bg-white p-6 rounded-lg shadow-md ${
                    isActive ? 'border-2 border-green-500' : ''
                  }`}
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="font-bold text-xl text-blue-600 mb-2">{class_.title}</h3>
                      <p className="text-gray-600 mb-1">
                        Professor: {class_.professor?.name}
                      </p>
                      <p className="text-gray-600 mb-1">
                        Data: {new Date(class_.date).toLocaleDateString()}
                      </p>
                      <p className="text-gray-600 mb-1">
                        Horário: {class_.time}
                      </p>
                      <p className="text-gray-600 mb-1">
                        Duração: {class_.duration} minutos
                      </p>
                      <p className="text-gray-600">
                        Vagas: {class_.class_checkins?.length || 0}/{class_.max_students}
                      </p>
                    </div>
                    <div className="flex flex-col items-end space-y-2">
                      <span
                        className={`px-3 py-1 rounded-full text-sm font-medium ${
                          isActive
                            ? 'bg-green-100 text-green-800'
                            : classDate < now
                            ? 'bg-gray-100 text-gray-800'
                            : 'bg-blue-100 text-blue-800'
                        }`}
                      >
                        {isActive 
                          ? 'Em andamento' 
                          : classDate < now 
                          ? 'Encerrada'
                          : 'Agendada'}
                      </span>
                      {hasCheckedIn ? (
                        <span className="text-green-600 font-medium">
                          ✓ Check-in realizado
                        </span>
                      ) : (
                        <button
                          onClick={() => handleCheckin(class_.id)}
                          disabled={!isActive || isFull || classDate < now}
                          className={`px-4 py-2 rounded-lg text-white font-medium ${
                            isActive && !isFull && classDate >= now
                              ? 'bg-blue-500 hover:bg-blue-600'
                              : 'bg-gray-400 cursor-not-allowed'
                          }`}
                        >
                          {isFull 
                            ? 'Aula lotada' 
                            : classDate < now 
                            ? 'Aula encerrada'
                            : !isActive 
                            ? 'Aguardando início' 
                            : 'Fazer Check-in'}
                        </button>
                      )}
                    </div>
                  </div>
                  {hasCheckedIn && (
                    <div className="mt-4 p-3 bg-green-50 rounded-lg">
                      <p className="text-green-700">
                        Você já está confirmado nesta aula. Não se esqueça de comparecer no horário!
                      </p>
                    </div>
                  )}
                </div>
              );
            })}
            {classes.length === 0 && (
              <div className="bg-white p-6 rounded-lg shadow-md text-center">
                <p className="text-gray-600">
                  Nenhuma aula disponível no momento.
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}