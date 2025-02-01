import React, { useState, useEffect } from 'react';
import { useAuthStore } from '../store/authStore';
import { supabase } from '../lib/supabase';

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
  trainings: Training;
  profiles: {
    name: string;
  };
}

export default function ProfessorDashboard() {
  const { user } = useAuthStore();
  const [trainings, setTrainings] = useState<Training[]>([]);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [newTraining, setNewTraining] = useState<Partial<Training>>({
    title: '',
    description: '',
    date: '',
    duration: 0,
    difficulty: 'iniciante',
  });
  const [editingTraining, setEditingTraining] = useState<Training | null>(null); // Treino em edição
  const [expandedWeeks, setExpandedWeeks] = useState<string[]>([]);
  const [expandedDates, setExpandedDates] = useState<string[]>([]);

  useEffect(() => {
    const fetchTrainings = async () => {
      const { data, error } = await supabase
        .from('trainings')
        .select('*')
        .eq('professor_id', user?.id)
        .order('date', { ascending: true }); // Ordenar por data

      if (error) {
        console.error('Erro ao buscar treinos:', error);
      } else {
        setTrainings(data as Training[]);
      }
    };

    fetchTrainings();
  }, [user]);

  useEffect(() => {
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

    fetchAttendance();
  }, [user]);

  // Cadastrar novo treino
  const handleCreateTraining = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const { data, error } = await supabase
      .from('trainings')
      .insert([{ ...newTraining, professor_id: user?.id }]);

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

  // Excluir treino
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

  // Abrir modal de edição
  const openEditModal = (training: Training) => {
    setEditingTraining(training);
  };

  // Fechar modal de edição
  const closeEditModal = () => {
    setEditingTraining(null);
  };

  // Salvar edição do treino
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

  // Função para agrupar treinos por semana
  const groupTrainingsByWeek = (trainings: Training[]) => {
    const grouped: Record<string, Training[]> = {};

    trainings.forEach((training) => {
      const date = new Date(training.date);
      const startOfWeek = new Date(date);
      startOfWeek.setDate(date.getDate() - date.getDay() + 1); // Segunda-feira da semana
      const endOfWeek = new Date(startOfWeek);
      endOfWeek.setDate(startOfWeek.getDate() + 5); // Sábado da semana

      const weekKey = `${startOfWeek.toLocaleDateString()} - ${endOfWeek.toLocaleDateString()}`;

      if (!grouped[weekKey]) {
        grouped[weekKey] = [];
      }
      grouped[weekKey].push(training);
    });

    return grouped;
  };

  // Agrupar treinos por semana
  const groupedTrainings = groupTrainingsByWeek(trainings);

  // Alternar a expansão de uma semana específica
  const toggleWeek = (weekKey: string) => {
    if (expandedWeeks.includes(weekKey)) {
      setExpandedWeeks(expandedWeeks.filter((key) => key !== weekKey));
    } else {
      setExpandedWeeks([...expandedWeeks, weekKey]);
    }
  };

  // Agrupar frequência por data
  const groupedAttendance = attendance.reduce((acc, record) => {
    const date = new Date(record.trainings.date).toLocaleDateString();
    if (!acc[date]) {
      acc[date] = [];
    }
    acc[date].push(record);
    return acc;
  }, {} as Record<string, AttendanceRecord[]>);

  // Alternar a expansão de uma data específica
  const toggleDate = (date: string) => {
    if (expandedDates.includes(date)) {
      setExpandedDates(expandedDates.filter(d => d !== date));
    } else {
      setExpandedDates([...expandedDates, date]);
    }
  };

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <h1 className="text-3xl font-bold text-center mb-8 text-blue-600">Área do Professor</h1>

      {/* Formulário para cadastrar treino */}
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

      {/* Lista de treinos cadastrados agrupados por semana */}
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

      {/* Modal de edição */}
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

      {/* Frequência dos alunos agrupada por data */}
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
                  <div key={record.id} className="mb-2 p-2 border rounded-lg">
                    <p className="font-semibold">Aluno: {record.profiles.name}</p>
                    <p className="text-gray-600">Treino: {record.trainings.title}</p>
                    <p>Concluído em: {new Date(record.completed_at).toLocaleString()}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}