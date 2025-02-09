import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase'; // Certifique-se de que o caminho está correto
import { useAuthStore } from '../store/authStore';
import { FaEdit, FaTrash } from 'react-icons/fa'; // Ícones de edição e exclusão

type TimeEntry = {
  id: string;
  distance: string;
  style: string;
  time_seconds: number;
};

const MyTimes: React.FC = () => {
  const { user } = useAuthStore();
  const [times, setTimes] = useState<TimeEntry[]>([]);
  const [distance, setDistance] = useState<string>('50m');
  const [style, setStyle] = useState<string>('crawl');
  const [minutes, setMinutes] = useState<string>('');
  const [seconds, setSeconds] = useState<string>('');
  const [centiseconds, setCentiseconds] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [editingTimeId, setEditingTimeId] = useState<string | null>(null); // ID do tempo sendo editado

  useEffect(() => {
    fetchTimes();
  }, []);

  const fetchTimes = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('swimming_times')
      .select('*')
      .eq('student_id', user?.id);

    if (error) {
      console.error('Erro ao buscar tempos:', error);
    } else {
      setTimes(data as TimeEntry[]);
    }
    setLoading(false);
  };

  const handleAddTime = async () => {
    const timeInSeconds = convertToSeconds(minutes, seconds, centiseconds);
    if (timeInSeconds !== null) {
      setLoading(true);
      const { data, error } = await supabase
        .from('swimming_times')
        .insert([{ student_id: user?.id, distance, style, time_seconds: timeInSeconds }])
        .select();

      if (error) {
        console.error('Erro ao salvar tempo:', error);
      } else if (data && data.length > 0) {
        setTimes([...times, { id: data[0].id, distance, style, time_seconds: timeInSeconds }]);
      }
      setLoading(false);
      setMinutes('');
      setSeconds('');
      setCentiseconds('');
    }
  };

  const handleEditTime = (time: TimeEntry) => {
    // Preenche os campos com os valores do tempo selecionado
    const min = Math.floor(time.time_seconds / 60);
    const sec = Math.floor(time.time_seconds % 60);
    const cent = Math.round((time.time_seconds - Math.floor(time.time_seconds)) * 100);
    setMinutes(min.toString());
    setSeconds(sec.toString());
    setCentiseconds(cent.toString());
    setDistance(time.distance);
    setStyle(time.style);
    setEditingTimeId(time.id); // Define o ID do tempo sendo editado
  };

  const handleUpdateTime = async () => {
    const timeInSeconds = convertToSeconds(minutes, seconds, centiseconds);
    if (timeInSeconds !== null && editingTimeId) {
      setLoading(true);
      const { error } = await supabase
        .from('swimming_times')
        .update({ distance, style, time_seconds: timeInSeconds })
        .eq('id', editingTimeId);

      if (error) {
        console.error('Erro ao atualizar tempo:', error);
      } else {
        // Atualiza a lista de tempos
        const updatedTimes = times.map((time) =>
          time.id === editingTimeId
            ? { ...time, distance, style, time_seconds: timeInSeconds }
            : time
        );
        setTimes(updatedTimes);
        setEditingTimeId(null); // Sai do modo de edição
      }
      setLoading(false);
      setMinutes('');
      setSeconds('');
      setCentiseconds('');
    }
  };

  const handleDeleteTime = async (id: string) => {
    setLoading(true);
    const { error } = await supabase.from('swimming_times').delete().eq('id', id);

    if (error) {
      console.error('Erro ao excluir tempo:', error);
    } else {
      // Remove o tempo da lista
      const updatedTimes = times.filter((time) => time.id !== id);
      setTimes(updatedTimes);
    }
    setLoading(false);
  };

  const convertToSeconds = (minutes: string, seconds: string, centiseconds: string): number | null => {
    const min = parseInt(minutes, 10) || 0;
    const sec = parseInt(seconds, 10) || 0;
    const cent = parseInt(centiseconds, 10) || 0;

    if (isNaN(min) || isNaN(sec) || isNaN(cent) || sec >= 60 || cent >= 100) {
      alert('Por favor, insira valores válidos: segundos < 60 e centésimos < 100.');
      return null;
    }

    return min * 60 + sec + cent / 100;
  };

  const formatTime = (timeInSeconds: number): string => {
    const min = Math.floor(timeInSeconds / 60);
    const sec = Math.floor(timeInSeconds % 60);
    const cent = Math.round((timeInSeconds - Math.floor(timeInSeconds)) * 100);
  
    // Para menos de 1 minuto, apenas mostra segundos e centésimos
    if (min === 0) {
      return `${sec < 10 ? `0${sec}` : sec}"${cent < 10 ? `0${cent}` : cent}`;
    }
  
    // Para menos de 10 minutos, remove o 0 à frente
    const formattedMin = min < 10 ? `${min}` : `${min}`;
    const formattedSec = sec < 10 ? `0${sec}` : sec;
    const formattedCent = cent < 10 ? `0${cent}` : cent;
  
    // Para 10 minutos ou mais, mantemos o formato completo
    if (min >= 10) {
      return `${formattedMin}'${formattedSec}"${formattedCent}`;
    }
  
    // Para menos de 10 minutos mas mais de 0, mostra minutos sem o 0 à frente
    return `${formattedMin}'${formattedSec}"${formattedCent}`;
  };

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <h2 className="text-2xl font-bold mb-6 text-gray-800">Meus Tempos</h2>
      <div>
        <label className="block mb-2">
          Metros:
          <select
            value={distance}
            onChange={(e) => setDistance(e.target.value)}
            className="block w-full mt-1 p-2 border rounded-lg"
          >
            <option value="50m">50m</option>
            <option value="100m">100m</option>
            <option value="200m">200m</option>
            <option value="400m">400m</option>
            <option value="800m">800m</option>
            <option value="1500m">1500m</option>
          </select>
        </label>
      </div>
      <div>
        <label className="block mb-2">
          Estilo:
          <select
            value={style}
            onChange={(e) => setStyle(e.target.value)}
            className="block w-full mt-1 p-2 border rounded-lg"
          >
            <option value="crawl">Crawl</option>
            <option value="costas">Costas</option>
            <option value="peito">Peito</option>
            <option value="borboleta">Borboleta</option>
            <option value="medley">Medley</option>
          </select>
        </label>
      </div>
      <div className="flex space-x-4 mb-4">
        <label className="block flex-1">
          Minutos:
          <input
            type="number"
            placeholder="MM"
            value={minutes}
            onChange={(e) => setMinutes(e.target.value)}
            className="block w-full mt-1 p-2 border rounded-lg"
            min="0"
          />
        </label>
        <label className="block flex-1">
          Segundos:
          <input
            type="number"
            placeholder="SS"
            value={seconds}
            onChange={(e) => setSeconds(e.target.value)}
            className="block w-full mt-1 p-2 border rounded-lg"
            min="0"
            max="59"
          />
        </label>
        <label className="block flex-1">
          Centésimos:
          <input
            type="number"
            placeholder="CC"
            value={centiseconds}
            onChange={(e) => setCentiseconds(e.target.value)}
            className="block w-full mt-1 p-2 border rounded-lg"
            min="0"
            max="99"
          />
        </label>
      </div>
      <button
        onClick={editingTimeId ? handleUpdateTime : handleAddTime}
        className="mt-4 w-full bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 transition-colors"
        disabled={loading}
      >
        {loading ? 'Salvando...' : editingTimeId ? 'Atualizar' : 'Salvar'}
      </button>
      <h3 className="text-xl font-bold mt-6 text-gray-800">Tempos Salvos</h3>
      <ul className="mt-4 space-y-2">
        {times.map((entry) => (
          <li key={entry.id} className="p-4 border rounded-lg bg-white flex justify-between items-center">
            <span>
              {entry.distance} - {entry.style} - {formatTime(entry.time_seconds)}
            </span>
            <div className="flex space-x-2">
              <button
                onClick={() => handleEditTime(entry)}
                className="text-blue-500 hover:text-blue-700"
              >
                <FaEdit />
              </button>
              <button
                onClick={() => handleDeleteTime(entry.id)}
                className="text-red-500 hover:text-red-700"
              >
                <FaTrash />
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default MyTimes;