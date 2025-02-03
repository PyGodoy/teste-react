import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase'; // Certifique-se de que o caminho está correto
import { useAuthStore } from '../store/authStore';

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
  const [time, setTime] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);

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
    if (time) {
      setLoading(true);
      const timeInSeconds = convertTimeToSeconds(time);
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
      setTime('');
    }
  };

  const convertTimeToSeconds = (time: string): number => {
    const [minutes, seconds] = time.split(':').map(Number);
    return minutes * 60 + seconds;
  };

  const formatTime = (timeInSeconds: number): string => {
    const minutes = Math.floor(timeInSeconds / 60);
    const seconds = timeInSeconds % 60;
    return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
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
      <div>
        <label className="block mb-2">
          Tempo:
          <input
            type="text"
            placeholder="00:00"
            value={time}
            onChange={(e) => setTime(e.target.value)}
            className="block w-full mt-1 p-2 border rounded-lg"
          />
        </label>
      </div>
      <button
        onClick={handleAddTime}
        className="mt-4 w-full bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 transition-colors"
        disabled={loading}
      >
        {loading ? 'Salvando...' : 'Salvar'}
      </button>
      <h3 className="text-xl font-bold mt-6 text-gray-800">Tempos Salvos</h3>
      <ul className="mt-4 space-y-2">
        {times.map((entry) => (
          <li key={entry.id} className="p-4 border rounded-lg bg-white">
            {entry.distance} - {entry.style} - {formatTime(entry.time_seconds)}
          </li>
        ))}
      </ul>
    </div>
  );
};

export default MyTimes;