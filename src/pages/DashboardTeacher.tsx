import React, { useState, useEffect } from 'react';
import { useAuthStore } from '../store/authStore';
import { supabase } from '../lib/supabase';
import { StudentProfile } from '../types';
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

interface Training {
  id: number;
  title: string;
  description: string;
  date: string;
  duration: number;
  difficulty: string;
  professor_id: string;
}

interface AttendanceRecord {
  id: number;
  training_id: number;
  student_id: number;
  completed_at: string;
  feedback: string | null;
  maintained_time: string | null;
  trainings: Training;
  profiles: {
    name: string;
  };
}

// Primeiro, defina as interfaces necessárias
interface UserInfo {
  id: string;
  email: string;
  name: string;
}

interface Checkin {
  id: number;
  student_id: string;
  checked_in_at: string;
  student: UserInfo;
}

interface ClassCheckinRaw {
  id: number;
  student_id: string;
  checked_in_at: string;
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
  professor: UserInfo;
  class_checkins: Checkin[];
}

interface StudentPerformanceData {
  date: string;
  seconds: number;
  displayTime: string;
}

interface BestTime {
  id: number;
  student_id: string;
  time: string;
  description: string;
  created_at: string;
}

interface SwimmingTime {
  id: string;
  distance: string;
  style: string;
  time_seconds: number;
}

interface NewClass {
  title: string;
  date: string;
  time: string;
  duration: number;
  max_students: number;
}

type PeriodFilter = 'all' | 'week' | 'month' | 'custom';
type AverageView = 'daily' | 'weekly' | 'monthly';

interface PerformanceData {
  date: string;
  seconds: number;
  displayTime: string;
}

export default function ProfessorDashboard() {
  const { user } = useAuthStore();
  const [trainings, setTrainings] = useState<Training[]>([]);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [students, setStudents] = useState<StudentProfile[]>([]);
  const [activeTab, setActiveTab] = useState<'trainings' | 'students' | 'attendance' | 'classes'>('trainings');
  const [newTraining, setNewTraining] = useState<Partial<Training>>({
    title: '',
    description: '',
    date: '',
    duration: 0,
    difficulty: 'iniciante',
  });
  const [editingTraining, setEditingTraining] = useState<Training | null>(null);
  const [expandedWeeks, setExpandedWeeks] = useState<string[]>([]);
  const [expandedDates, setExpandedDates] = useState<string[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);
  const [newClass, setNewClass] = useState<NewClass>({
    title: '',
    date: '',
    time: '',
    duration: 60,
    max_students: 10
  });
  const [selectedStudent, setSelectedStudent] = useState<StudentProfile | null>(null);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [studentPerformance, setStudentPerformance] = useState<StudentPerformanceData[]>([]);
  const [studentBestTimes, setStudentBestTimes] = useState<BestTime[]>([]);
  const [studentSwimmingTimes, setStudentSwimmingTimes] = useState<SwimmingTime[]>([]);
  const [studentPeriodFilter, setStudentPeriodFilter] = useState<PeriodFilter>('all');
  const [studentAverageView, setStudentAverageView] = useState<AverageView>('daily');
  const [studentCustomDateRange, setStudentCustomDateRange] = useState({
  startDate: '',
  endDate: '',
});

  const fetchTrainings = async () => {
    const { data, error } = await supabase
      .from('trainings')
      .select('*')
      .eq('professor_id', user?.id)
      .order('date', { ascending: true });

    if (error) {
      console.error('Erro ao buscar treinos:', error);
    } else {
      setTrainings(data as Training[]);
    }
  };

  const fetchAttendance = async () => {
    const { data, error } = await supabase
      .from('attendances')
      .select(`
        *,
        trainings!inner (
          id,
          title,
          date,
          difficulty,
          professor_id
        ),
        profiles!inner (
          name
        )
      `)
      .eq('trainings.professor_id', user?.id);

    if (error) {
      console.error('Erro ao buscar frequência:', error);
    } else {
      setAttendance(data as AttendanceRecord[]);
    }
  };

  const fetchStudents = async () => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('role', 'aluno')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Erro ao buscar alunos:', error);
    } else {
      setStudents(data as StudentProfile[]);
    }
  };

  // Agora atualize a função fetchClasses
  const fetchClasses = async () => {
    const { data, error } = await supabase
      .from('classes')
      .select(`
        *,
        class_checkins (
          id,
          student_id,
          checked_in_at
        )
      `)
      .order('date', { ascending: true })
      .order('time', { ascending: true });
  
    if (error) {
      console.error('Erro ao buscar aulas:', error);
      return;
    }
  
    // Buscar informações dos professores da tabela profiles
    const professorIds = [...new Set((data || []).map(item => item.professor_id))];
    const { data: professorsData } = await supabase
      .from('profiles')
      .select('id, name, email')
      .in('id', professorIds);
  
    // Buscar informações dos alunos da tabela profiles
    const studentIds = [...new Set(
      (data || [])
        .flatMap(item => item.class_checkins || [])
        .map(checkin => checkin.student_id)
    )];
    const { data: studentsData } = await supabase
      .from('profiles')
      .select('id, name, email')
      .in('id', studentIds);
  
    // Criar maps para fácil acesso
    const professorsMap = new Map(
      (professorsData || []).map(prof => [prof.id, prof])
    );
    const studentsMap = new Map(
      (studentsData || []).map(student => [student.id, student])
    );
  
    const formattedData = (data || []).map(item => ({
      ...item,
      professor: {
        id: item.professor_id,
        email: professorsMap.get(item.professor_id)?.email || '',
        name: professorsMap.get(item.professor_id)?.name || 'Professor'
      },
      class_checkins: (item.class_checkins || []).map((checkin: ClassCheckinRaw): Checkin => ({
        id: checkin.id,
        student_id: checkin.student_id,
        checked_in_at: checkin.checked_in_at,
        student: {
          id: checkin.student_id,
          email: studentsMap.get(checkin.student_id)?.email || '',
          name: studentsMap.get(checkin.student_id)?.name || 'Aluno'
        }
      }))
    }));
  
    setClasses(formattedData);
  };

  useEffect(() => {
    if (user) {
      fetchTrainings();
      fetchAttendance();
      fetchStudents();
      fetchClasses();
    }
  }, [user]);

  const fetchStudentPerformance = async (studentId: string) => {
    const { data, error } = await supabase
      .from('attendances')
      .select(`
        completed_at,
        maintained_time
      `)
      .eq('student_id', studentId)
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
          const [minutes, seconds] = (record.maintained_time || '0:00').split(':').map(Number);
          const totalSeconds = (minutes * 60) + seconds;
          const utcDate = new Date(record.completed_at);
          const localDate = new Date(utcDate.getTime() + utcDate.getTimezoneOffset() * 60000);
          
          return {
            date: localDate.toLocaleDateString('pt-BR'),
            seconds: totalSeconds,
            displayTime: record.maintained_time || '0:00'
          };
        });
  
      setStudentPerformance(formattedData);
    }
  };

  const fetchStudentSwimmingTimes = async (studentId: string) => {
    try {
      const { data, error } = await supabase
        .from('swimming_times')
        .select('*')
        .eq('student_id', studentId);
  
      if (error) {
        console.error('Erro ao buscar tempos de natação:', error.message);
        return;
      }
  
      if (data) {
        setStudentSwimmingTimes(data);
      }
    } catch (err) {
      console.error('Erro na execução da função:', err);
    }
  };

  const formatTime = (timeInSeconds: number): string => {
    const minutes = Math.floor(timeInSeconds / 60);
    const seconds = timeInSeconds % 60;
    return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
  };

  const filterDataByPeriod = (
    data: PerformanceData[], 
    filter: PeriodFilter,
    customRange?: { startDate: string; endDate: string }
  ) => {
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
          if (!customRange) return true;
          const start = customRange.startDate ? new Date(customRange.startDate) : new Date(0);
          const end = customRange.endDate ? new Date(customRange.endDate) : new Date();
          return itemDate >= start && itemDate <= end;
        default:
          return true;
      }
    });
  
    return calculateAverages(filteredData, studentAverageView);
  };

  const formatSecondsToTime = (seconds: number): string => {
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

  const handleAuthorizeStudent = async (studentId: string, authorize: boolean) => {
    const { error } = await supabase
      .from('profiles')
      .update({ is_authorized: authorize })
      .eq('id', studentId);

    if (error) {
      console.error('Erro ao autorizar/desautorizar aluno:', error);
      alert('Erro ao atualizar status do aluno');
    } else {
      fetchStudents();
      alert(`Aluno ${authorize ? 'autorizado' : 'desautorizado'} com sucesso!`);
    }
  };

  const handleCreateTraining = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    
    const { data, error } = await supabase
      .from('trainings')
      .insert([{ ...newTraining, professor_id: user?.id }])
      .select();
  
    if (error) {
      console.error('Erro ao criar treino:', error);
    } else {
      if (data && data.length > 0) {
        setTrainings([...trainings, data[0] as Training]);
      }
      setNewTraining({
        title: '',
        description: '',
        date: '',
        duration: 0,
        difficulty: 'iniciante',
      });
    }
  };

  // No handleCreateClass (ProfessorDashboard.tsx)
  const handleCreateClass = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
  
    if (!newClass.date || !newClass.time) {
      alert('Data e horário são obrigatórios');
      return;
    }
  
    try {
      // Criar a data no formato correto para o banco
      const classData = {
        title: newClass.title,
        date: newClass.date, // exemplo: "2025-02-03"
        time: newClass.time, // exemplo: "23:07:00"
        duration: newClass.duration,
        max_students: newClass.max_students,
        professor_id: user?.id
      };
  
      const { data, error } = await supabase
        .from('classes')
        .insert([classData])
        .select();
  
      if (error) {
        console.error('Erro ao criar aula:', error);
        alert('Erro ao criar aula');
        return;
      }
  
      alert('Aula criada com sucesso!');
      fetchClasses();
      
      // Resetar o formulário
      setNewClass({
        title: '',
        date: '',
        time: '',
        duration: 60,
        max_students: 10
      });
  
    } catch (err) {
      console.error('Erro ao criar aula:', err);
      alert('Erro ao criar aula');
    }
  };

  const handleDeleteTraining = async (trainingId: number) => {
    const { error } = await supabase
      .from('trainings')
      .delete()
      .eq('id', trainingId);

    if (error) {
      console.error('Erro ao excluir treino:', error);
    } else {
      setTrainings(trainings.filter((training) => training.id !== trainingId));
    }
  };

  const openEditModal = (training: Training) => {
    setEditingTraining(training);
  };

  const closeEditModal = () => {
    setEditingTraining(null);
  };

  const handleEditTraining = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!editingTraining) return;

    const { error } = await supabase
      .from('trainings')
      .update(editingTraining)
      .eq('id', editingTraining.id);

    if (error) {
      console.error('Erro ao editar treino:', error);
    } else {
      setTrainings(trainings.map((training) =>
        training.id === editingTraining.id ? editingTraining : training
      ));
      closeEditModal();
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

  const groupedTrainings = groupTrainingsByWeek(trainings);

  const toggleWeek = (weekKey: string) => {
    if (expandedWeeks.includes(weekKey)) {
      setExpandedWeeks(expandedWeeks.filter((key) => key !== weekKey));
    } else {
      setExpandedWeeks([...expandedWeeks, weekKey]);
    }
  };

  const groupedAttendance = attendance.reduce((acc, record) => {
    const date = new Date(record.trainings.date).toLocaleDateString();
    if (!acc[date]) {
      acc[date] = [];
    }
    acc[date].push(record);
    return acc;
  }, {} as Record<string, AttendanceRecord[]>);

  const toggleDate = (date: string) => {
    if (expandedDates.includes(date)) {
      setExpandedDates(expandedDates.filter(d => d !== date));
    } else {
      setExpandedDates([...expandedDates, date]);
    }
  };

  const StudentProfileModal = () => {
    if (!selectedStudent) return null;
  
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
        <div className="bg-white p-6 rounded-lg shadow-md w-full max-w-4xl max-h-[90vh] overflow-y-auto">
          <div className="flex justify-between items-start mb-6">
            <h2 className="text-2xl font-bold text-gray-800">
              Perfil do Aluno: {selectedStudent.name}
            </h2>
            <button
              onClick={() => setShowProfileModal(false)}
              className="text-gray-500 hover:text-gray-700"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
  
          {/* Seção de Melhores Tempos */}
          <div className="mb-8">
            <h3 className="text-xl font-semibold mb-4 text-blue-600">Melhores Tempos</h3>
            <div className="bg-gray-50 p-4 rounded-lg">
              {studentSwimmingTimes.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="min-w-full">
                    <thead>
                      <tr>
                        <th className="px-4 py-2 text-left">Distância</th>
                        <th className="px-4 py-2 text-left">Estilo</th>
                        <th className="px-4 py-2 text-left">Tempo</th>
                      </tr>
                    </thead>
                    <tbody>
                      {studentSwimmingTimes.map((time) => (
                        <tr key={time.id} className="hover:bg-gray-100">
                          <td className="px-4 py-2">{time.distance}</td>
                          <td className="px-4 py-2">
                            {time.style.charAt(0).toUpperCase() + time.style.slice(1)}
                          </td>
                          <td className="px-4 py-2 font-medium">{formatTime(time.time_seconds)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-gray-600 text-center">
                  Este aluno ainda não registrou nenhum tempo.
                </p>
              )}
            </div>
          </div>
  
          {/* Gráfico de Desempenho */}
          <div>
            <h3 className="text-xl font-semibold mb-4 text-blue-600">Gráfico de Desempenho</h3>
            
            {/* Controles de filtro */}
            <div className="bg-white p-2 sm:p-4 rounded-lg shadow-md mb-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 sm:gap-4">
                {/* Filtro de Período */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1 sm:mb-2">
                    Período
                  </label>
                  <select
                    value={studentPeriodFilter}
                    onChange={(e) => setStudentPeriodFilter(e.target.value as PeriodFilter)}
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
                    value={studentAverageView}
                    onChange={(e) => setStudentAverageView(e.target.value as AverageView)}
                    className="w-full p-1 sm:p-2 text-sm border rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="daily">Diária</option>
                    <option value="weekly">Média Semanal</option>
                    <option value="monthly">Média Mensal</option>
                  </select>
                </div>
              </div>

              {/* Datas personalizadas */}
              {studentPeriodFilter === 'custom' && (
                <div className="mt-2 sm:mt-4 grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1 sm:mb-2">
                      Data Inicial
                    </label>
                    <input
                      type="date"
                      value={studentCustomDateRange.startDate}
                      onChange={(e) => setStudentCustomDateRange(prev => ({
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
                      value={studentCustomDateRange.endDate}
                      onChange={(e) => setStudentCustomDateRange(prev => ({
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
            <div className="bg-white p-4 rounded-lg shadow-sm">
              <div className="h-[400px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={filterDataByPeriod(studentPerformance, studentPeriodFilter, studentCustomDateRange)}
                    margin={{
                      top: 5,
                      right: 5,
                      left: 0,
                      bottom: 40,
                    }}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis
                      dataKey="date"
                      angle={-45}
                      textAnchor="end"
                      height={60}
                      tick={{
                        fontSize: 10,
                        dy: 10
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
                        fontSize: 12
                      }}
                      tick={{
                        fontSize: 10
                      }}
                      tickFormatter={(value) => {
                        const minutes = Math.floor(value / 60);
                        const seconds = value % 60;
                        return `${minutes}:${seconds.toString().padStart(2, '0')}`;
                      }}
                      width={40}
                    />
                    <Tooltip
                      formatter={(value: number) => {
                        const minutes = Math.floor(value / 60);
                        const seconds = value % 60;
                        return [`${minutes}:${seconds.toString().padStart(2, '0')}`, 'Tempo mantido'];
                      }}
                      contentStyle={{
                        fontSize: '12px'
                      }}
                    />
                    <Legend
                      wrapperStyle={{
                        fontSize: '12px',
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
                        r: 4,
                        fill: '#2563eb',
                        strokeWidth: 2
                      }}
                      activeDot={{
                        r: 6,
                        fill: '#1e40af',
                        strokeWidth: 2
                      }}
                      isAnimationActive={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Tabela de dados */}
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
                  {filterDataByPeriod(studentPerformance, studentPeriodFilter, studentCustomDateRange)
                    .map((item, index) => (
                      <tr key={index} className={index % 2 === 0 ? 'bg-gray-50' : ''}>
                        <td className="px-2 py-1 text-sm sm:text-base">{item.date}</td>
                        <td className="px-2 py-1 text-sm sm:text-base">{item.displayTime}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <h1 className="text-3xl font-bold text-center mb-8 text-blue-600">Área do Professor</h1>

      <div className="max-w-7xl mx-auto mb-8">
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex space-x-4 sm:space-x-8 overflow-x-auto whitespace-nowrap">
            <button
              onClick={() => setActiveTab('trainings')}
              className={`${
                activeTab === 'trainings'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
            >
              Treinos
            </button>
            <button
              onClick={() => setActiveTab('students')}
              className={`${
                activeTab === 'students'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
            >
              Gerenciar Alunos
            </button>
            <button
              onClick={() => setActiveTab('attendance')}
              className={`${
                activeTab === 'attendance'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
            >
              Frequência
            </button>
            <button
              onClick={() => setActiveTab('classes')}
              className={`${
                activeTab === 'classes'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
            >
              Classes
            </button>
          </nav>
        </div>
      </div>

      {activeTab === 'classes' && (
        <div className="max-w-7xl mx-auto">
          <form onSubmit={handleCreateClass} className="mb-8 bg-white p-6 rounded-lg shadow-md">
            <h2 className="text-2xl font-bold mb-4 text-gray-800">Criar Nova Aula</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-gray-700 font-medium mb-2">Título da Aula</label>
                <input
                  type="text"
                  value={newClass.title}
                  onChange={(e) => setNewClass({ ...newClass, title: e.target.value })}
                  className="w-full p-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
              <div>
                <label className="block text-gray-700 font-medium mb-2">Data</label>
                <input
                  type="date"
                  value={newClass.date}
                  onChange={(e) => setNewClass({ ...newClass, date: e.target.value })}
                  className="w-full p-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
              <div>
                <label className="block text-gray-700 font-medium mb-2">Horário</label>
                <input
                  type="time"
                  value={newClass.time}
                  onChange={(e) => setNewClass({ ...newClass, time: e.target.value })}
                  className="w-full p-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
              <div>
                <label className="block text-gray-700 font-medium mb-2">Duração (minutos)</label>
                <input
                  type="number"
                  value={newClass.duration}
                  onChange={(e) => setNewClass({ ...newClass, duration: parseInt(e.target.value) })}
                  className="w-full p-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                  min="1"
                />
              </div>
              <div>
                <label className="block text-gray-700 font-medium mb-2">Máximo de Alunos</label>
                <input
                  type="number"
                  value={newClass.max_students}
                  onChange={(e) => setNewClass({ ...newClass, max_students: parseInt(e.target.value) })}
                  className="w-full p-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                  min="1"
                />
              </div>
            </div>
            <button
              type="submit"
              className="mt-4 w-full bg-blue-500 text-white p-2 rounded-lg hover:bg-blue-600 transition-colors"
            >
              Criar Aula
            </button>
          </form>

          {/* Lista de aulas */}
          <div className="bg-white p-6 rounded-lg shadow-md">
            <h2 className="text-2xl font-bold mb-4 text-gray-800">Aulas Agendadas</h2>
            <div className="space-y-4">
            {classes.map((class_) => {
            // Criar data e hora da aula
            const [year, month, day] = class_.date.split('-').map(Number);
            const [hours, minutes] = class_.time.split(':').map(Number);
            const classDate = new Date(year, month - 1, day, hours, minutes);

            // Data e hora atual
            const now = new Date();

            // Uma hora antes da aula
            const oneHourBefore = new Date(classDate);
            oneHourBefore.setHours(oneHourBefore.getHours() - 1);

            // Horário de término
            const classEndTime = new Date(classDate);
            classEndTime.setMinutes(classEndTime.getMinutes() + class_.duration);

            // Debug para ver os horários
            console.log({
              class: class_.title,
              date: class_.date,
              time: class_.time,
              nowLocal: now.toLocaleString(),
              classDateLocal: classDate.toLocaleString(),
              oneHourBeforeLocal: oneHourBefore.toLocaleString(),
              classEndTimeLocal: classEndTime.toLocaleString()
            });

            // Verifica se está no período ativo (entre 1h antes e o fim da aula)
            const isActive = now >= oneHourBefore && now <= classEndTime;

            return (
              <div
                key={class_.id}
                className={`p-4 border rounded-lg ${
                  isActive ? 'border-green-500 bg-green-50' : ''
                }`}
              >
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-bold text-lg text-blue-600">{class_.title}</h3>
                    <p className="text-gray-600">
                      {new Date(classDate).toLocaleDateString('pt-BR')} às {class_.time}
                    </p>
                    <p className="text-gray-600">
                      Duração: {class_.duration} minutos
                    </p>
                    <p className="text-gray-600">
                      Check-ins: {class_.class_checkins?.length || 0}/{class_.max_students}
                    </p>
                    {/* Adicionado para debug */}
                    <p className="text-xs text-gray-400">
                      Check-in disponível a partir de: {oneHourBefore.toLocaleTimeString()}
                    </p>
                    <p className="text-xs text-gray-400">
                      Término: {classEndTime.toLocaleTimeString()}
                    </p>
                  </div>
                  <span
                    className={`px-2 py-1 rounded-full text-sm ${
                      isActive
                        ? 'bg-green-100 text-green-800'
                        : now > classEndTime
                        ? 'bg-gray-100 text-gray-800'
                        : now < oneHourBefore
                        ? 'bg-yellow-100 text-yellow-800'
                        : 'bg-blue-100 text-blue-800'
                    }`}
                  >
                    {isActive 
                      ? 'Em andamento'
                      : now > classEndTime
                      ? 'Encerrada'
                      : now < oneHourBefore
                      ? 'Agendada'
                      : 'Em andamento'}
                  </span>
                </div>

                {/* Lista de check-ins */}
                {class_.class_checkins.length > 0 && (
                  <div className="mt-4">
                    <h4 className="font-medium text-gray-700 mb-2">Alunos presentes:</h4>
                    <ul className="space-y-2">
                      {class_.class_checkins.map((checkin) => (
                        <li key={checkin.student_id} className="text-gray-600">
                          {checkin.student.name} - Check-in:{' '}
                          {new Date(checkin.checked_in_at).toLocaleTimeString()}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            );
          })}
  </div>
</div>
        </div>
      )}

      {activeTab === 'students' && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-white shadow overflow-hidden sm:rounded-md">
            <ul className="divide-y divide-gray-200">
              {students.map((student) => (
                <li key={student.id}>
                  <div className="px-4 py-4 sm:px-6 flex flex-col sm:flex-row items-start sm:items-center justify-between">
                    <div className="flex flex-col">
                      <span className="text-sm font-medium text-gray-900">{student.name}</span>
                      <span className="text-sm text-gray-500">{student.email}</span>
                      <span className="text-xs text-gray-400">
                        Cadastrado em: {new Date(student.created_at).toLocaleDateString()}
                      </span>
                    </div>
                    <div className="mt-2 sm:mt-0 flex flex-col sm:flex-row items-start sm:items-center space-y-2 sm:space-y-0 sm:space-x-4">
                      <span className={`px-2 py-1 text-xs rounded-full ${
                        student.is_authorized
                          ? 'bg-green-100 text-green-800'
                          : 'bg-yellow-100 text-yellow-800'
                      }`}>
                        {student.is_authorized ? 'Autorizado' : 'Pendente'}
                      </span>
                      <button
                        onClick={() => {
                          setSelectedStudent(student);
                          setShowProfileModal(true);
                          fetchStudentPerformance(student.id);
                          fetchStudentSwimmingTimes(student.id);
                        }}
                        className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors text-sm"
                      >
                        Visualizar Perfil
                      </button>
                      <button
                        onClick={() => handleAuthorizeStudent(student.id, !student.is_authorized)}
                        className={`px-4 py-2 rounded-lg text-white text-sm font-medium ${
                          student.is_authorized
                            ? 'bg-red-500 hover:bg-red-600'
                            : 'bg-green-500 hover:bg-green-600'
                        } transition-colors`}
                      >
                        {student.is_authorized ? 'Desautorizar' : 'Autorizar'}
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {activeTab === 'trainings' && (
        <>
          <form onSubmit={handleCreateTraining} className="mb-8 bg-white p-6 rounded-lg shadow-md">
            <h2 className="text-2xl font-bold mb-4 text-gray-800">Cadastrar Novo Treino</h2>
            <div className="mb-4">
              <label className="block text-gray-700 font-medium mb-2">Título</label>
              <input
                type="text"
                value={newTraining.title}
                onChange={(e) => setNewTraining({ ...newTraining, title: e.target.value })}
                className="w-full p-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
            <div className="mb-4">
              <label className="block text-gray-700 font-medium mb-2">Descrição</label>
              <textarea
                value={newTraining.description}
                onChange={(e) => setNewTraining({ ...newTraining, description: e.target.value })}
                className="w-full p-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
            <div className="mb-4">
              <label className="block text-gray-700 font-medium mb-2">Data</label>
              <input
                type="date"
                value={newTraining.date}
                onChange={(e) => setNewTraining({ ...newTraining, date: e.target.value })}
                className="w-full p-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
            <div className="mb-4">
              <label className="block text-gray-700 font-medium mb-2">Duração (minutos)</label>
              <input
                type="number"
                value={newTraining.duration}
                onChange={(e) => setNewTraining({ ...newTraining, duration: parseInt(e.target.value) })}
                className="w-full p-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
            <div className="mb-4">
              <label className="block text-gray-700 font-medium mb-2">Dificuldade</label>
              <select
                value={newTraining.difficulty}
                onChange={(e) => setNewTraining({ ...newTraining, difficulty: e.target.value })}
                className="w-full p-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              >
                <option value="iniciante">Iniciante</option>
                <option value="intermediário">Intermediário</option>
                <option value="avançado">Avançado</option>
              </select>
            </div>
            <button
              type="submit"
              className="w-full bg-blue-500 text-white p-2 rounded-lg hover:bg-blue-600 transition-colors"
            >
              Cadastrar Treino
            </button>
          </form>

          <div className="mb-8 bg-white p-6 rounded-lg shadow-md">
            <h2 className="text-2xl font-bold mb-4 text-gray-800">Treinos Cadastrados</h2>
            <div className="space-y-4">
              {Object.entries(groupedTrainings).map(([weekKey, weekTrainings]) => (
                <div key={weekKey} className="bg-gray-50 p-4 rounded-lg">
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
                          className="p-4 border rounded-lg hover:shadow-md transition-shadow"
                        >
                          <h3 className="font-bold text-lg text-blue-600">{training.title}</h3>
                          <p className="text-gray-600 mb-2 whitespace-pre-line">{training.description}</p>
                          <div className="grid grid-cols-3 gap-4 text-sm">
                            <p>Data: {new Date(training.date).toLocaleDateString()}</p>
                            <p>Duração: {training.duration} minutos</p>
                            <p>Dificuldade: {training.difficulty}</p>
                          </div>
                          <div className="mt-4 flex space-x-2">
                            <button
                              onClick={() => openEditModal(training)}
                              className="bg-yellow-500 text-white px-4 py-2 rounded-lg hover:bg-yellow-600 transition-colors"
                            >
                              Editar
                            </button>
                            <button
                              onClick={() => handleDeleteTraining(training.id)}
                              className="bg-red-500 text-white px-4 py-2 rounded-lg hover:bg-red-600 transition-colors"
                            >
                              Excluir
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {editingTraining && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4">
              <div className="bg-white p-6 rounded-lg shadow-md w-full max-w-md">
                <h2 className="text-2xl font-bold mb-4 text-gray-800">Editar Treino</h2>
                <form onSubmit={handleEditTraining}>
                  <div className="mb-4">
                    <label className="block text-gray-700 font-medium mb-2">Título</label>
                    <input
                      type="text"
                      value={editingTraining.title}
                      onChange={(e) => setEditingTraining({ ...editingTraining, title: e.target.value })}
                      className="w-full p-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required
                    />
                  </div>
                  <div className="mb-4">
                    <label className="block text-gray-700 font-medium mb-2">Descrição</label>
                    <textarea
                      value={editingTraining.description}
                      onChange={(e) => setEditingTraining({ ...editingTraining, description: e.target.value })}
                      className="w-full p-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required
                    />
                  </div>
                  <div className="mb-4">
                    <label className="block text-gray-700 font-medium mb-2">Data</label>
                    <input
                      type="date"
                      value={editingTraining.date}
                      onChange={(e) => setEditingTraining({ ...editingTraining, date: e.target.value })}
                      className="w-full p-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required
                    />
                  </div>
                  <div className="mb-4">
                    <label className="block text-gray-700 font-medium mb-2">Duração (minutos)</label>
                    <input
                      type="number"
                      value={editingTraining.duration}
                      onChange={(e) => setEditingTraining({ ...editingTraining, duration: parseInt(e.target.value) })}
                      className="w-full p-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required
                    />
                  </div>
                  <div className="mb-4">
                    <label className="block text-gray-700 font-medium mb-2">Dificuldade</label>
                    <select
                      value={editingTraining.difficulty}
                      onChange={(e) => setEditingTraining({ ...editingTraining, difficulty: e.target.value })}
                      className="w-full p-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required
                    >
                      <option value="iniciante">Iniciante</option>
                      <option value="intermediário">Intermediário</option>
                      <option value="avançado">Avançado</option>
                    </select>
                  </div>
                  <div className="flex justify-end space-x-2">
                    <button
                      type="button"
                      onClick={closeEditModal}
                      className="bg-gray-500 text-white px-4 py-2 rounded-lg hover:bg-gray-600 transition-colors"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      className="bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 transition-colors"
                    >
                      Salvar
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </>
      )}

        {activeTab === 'attendance' && (
          <div className="bg-white p-6 rounded-lg shadow-md">
            <h2 className="text-2xl font-bold mb-4 text-gray-800">Frequência dos Alunos</h2>
            {Object.entries(groupedAttendance).map(([date, records]) => (
              <div key={date} className="mb-4">
                <button
                  onClick={() => toggleDate(date)}
                  className="w-full text-left p-2 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors flex justify-between items-center"
                >
                  <span className="font-semibold">{date}</span>
                  <span>{expandedDates.includes(date) ? '▲' : '▼'}</span>
                </button>
                {expandedDates.includes(date) && (
                  <div className="mt-2 pl-4">
                    {records.map((record) => (
                      <div key={record.id} className="mb-4 p-4 border rounded-lg bg-gray-50">
                        <div className="grid grid-cols-1 gap-2">
                          <p className="font-semibold text-lg text-blue-600">
                            Aluno: {record.profiles.name}
                          </p>
                          <p className="text-gray-700">
                            Treino: {record.trainings.title}
                          </p>
                          <p className="text-gray-600">
                            Concluído em: {new Date(record.completed_at).toLocaleString()}
                          </p>
                          
                          {/* Seção de Feedback */}
                          {record.feedback && (
                            <div className="mt-2">
                              <p className="font-medium text-gray-700">Feedback do aluno:</p>
                              <p className="ml-2 text-gray-600 bg-white p-2 rounded-lg border">
                                {record.feedback}
                              </p>
                            </div>
                          )}
                          
                          {/* Tempo mantido na série */}
                          {record.maintained_time && (
                            <div className="mt-2">
                              <p className="font-medium text-gray-700">Tempo mantido na série:</p>
                              <p className="ml-2 text-gray-600 bg-white p-2 rounded-lg border">
                                {record.maintained_time}
                              </p>
                            </div>
                          )}

                          {/* Indicador visual se não houver feedback ou tempo registrado */}
                          {!record.feedback && !record.maintained_time && (
                            <p className="text-gray-500 italic mt-2">
                              Nenhum feedback ou tempo registrado
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
        {showProfileModal && <StudentProfileModal />}
    </div>
  );
}