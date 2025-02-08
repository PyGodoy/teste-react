import React, { useState, useEffect, ChangeEvent } from 'react';
import { Camera } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { User } from '../types';

interface UserAvatarProps {
    user: User | null;
    className?: string;
    onAvatarUpdate?: (url: string) => void;
  }

const UserAvatar = ({ user, className = '', onAvatarUpdate }: UserAvatarProps) => {
  const [showModal, setShowModal] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Adiciona função para buscar URL da imagem
  const fetchAvatarUrl = async (url: string) => {
    try {
      const { data } = supabase.storage
        .from('avatars')
        .getPublicUrl(url.split('/').pop() || '');
      
      return data.publicUrl;
    } catch (error) {
      console.error('Erro ao buscar URL do avatar:', error);
      return null;
    }
  };

  // Modifica useEffect para buscar a URL atualizada
  useEffect(() => {
    const loadAvatar = async () => {
      if (user?.avatar_url) {
        // Busca os dados atualizados do perfil
        const { data: profile } = await supabase
          .from('profiles')
          .select('avatar_url')
          .eq('id', user.id)
          .single();
        
        if (profile?.avatar_url) {
          const url = await fetchAvatarUrl(profile.avatar_url);
          setAvatarUrl(url);
        }
      }
    };

    loadAvatar();
  }, [user]);

  const uploadAvatar = async (event: ChangeEvent<HTMLInputElement>) => {
    try {
      setUploading(true);
      setUploadError(null);
      
      if (!event.target.files || event.target.files.length === 0) {
        throw new Error('Você precisa selecionar uma imagem para fazer upload.');
      }

      if (!user?.id) {
        throw new Error('Usuário não encontrado.');
      }

      const file = event.target.files[0];
      
      // Verificar tamanho do arquivo (max 2MB)
      if (file.size > 2 * 1024 * 1024) {
        throw new Error('A imagem deve ter menos de 2MB');
      }

      // Verificar tipo do arquivo
      if (!file.type.startsWith('image/')) {
        throw new Error('O arquivo deve ser uma imagem');
      }

      const fileExt = file.name.split('.').pop()?.toLowerCase() || '';
      if (!['jpg', 'jpeg', 'png', 'gif'].includes(fileExt)) {
        throw new Error('Formato de arquivo não suportado');
      }

      const fileName = `${user.id}-${Date.now()}.${fileExt}`;

      // Remover arquivo antigo se existir
      if (avatarUrl) {
        const oldFileName = avatarUrl.split('/').pop();
        if (oldFileName) {
          await supabase.storage
            .from('avatars')
            .remove([oldFileName]);
        }
      }

      // Upload do novo arquivo
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(fileName, file, { 
          cacheControl: '3600',  // Adiciona cache control
          upsert: false,
          contentType: file.type
        });

      if (uploadError) {
        throw new Error(`Erro no upload: ${uploadError.message}`);
      }

      // Obter URL pública
      const { data: urlData } = supabase.storage
        .from('avatars')
        .getPublicUrl(fileName);

      const publicUrl = urlData.publicUrl;

      // Atualizar perfil com a URL completa do bucket
      const { data: profileData, error: updateError } = await supabase
        .from('profiles')
        .update({
          avatar_url: publicUrl,
          updated_at: new Date().toISOString()
        })
        .eq('id', user.id)
        .select()
        .single();
      
      if (updateError) {
        throw new Error(`Erro ao atualizar perfil: ${updateError.message}`);
      }

      // Atualiza o estado com a URL pública
      setAvatarUrl(publicUrl);
      if (onAvatarUpdate) {
        onAvatarUpdate(publicUrl);
      }
      setShowModal(false);

    } catch (error) {
      console.error('Erro durante o processo:', error);
      if (error instanceof Error) {
        setUploadError(error.message);
      } else {
        setUploadError('Ocorreu um erro ao fazer upload da imagem.');
      }
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="relative">
      <button
        onClick={() => setShowModal(true)}
        className={`relative group ${className}`}
        type="button"
      >
        {avatarUrl ? (
          <img
            src={avatarUrl}
            alt="Avatar"
            className="w-10 h-10 rounded-full object-cover"
            onError={(e) => {
              console.error('Erro ao carregar imagem:', e);
              setAvatarUrl(null);
            }}
          />
        ) : (
          <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center">
            <span className="text-gray-500 text-lg font-medium">
              {user?.name?.charAt(0)?.toUpperCase()}
            </span>
          </div>
        )}
        <div className="absolute inset-0 rounded-full bg-black bg-opacity-0 group-hover:bg-opacity-30 transition-all flex items-center justify-center">
          <Camera className="text-white opacity-0 group-hover:opacity-100 w-5 h-5" />
        </div>
      </button>

      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-sm w-full mx-4">
            <h3 className="text-lg font-semibold mb-4">Alterar foto de perfil</h3>
            <div className="space-y-4">
              <input
                type="file"
                accept="image/*"
                onChange={uploadAvatar}
                disabled={uploading}
                className="w-full border p-2 rounded"
              />
              {uploading && (
                <div className="text-sm text-gray-500">
                  Fazendo upload...
                </div>
              )}
              {uploadError && (
                <div className="text-sm text-red-500">
                  {uploadError}
                </div>
              )}
              <div className="flex justify-end space-x-2">
                <button
                  onClick={() => {
                    setShowModal(false);
                    setUploadError(null);
                  }}
                  disabled={uploading}
                  className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300 disabled:opacity-50"
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserAvatar;