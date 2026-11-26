// frontend/src/api/authApi.js
import axiosInstance from './axiosInstance';

export const fetchUsers = async () => {
  const response = await axiosInstance.get('/api/auth');
  return response.data;
};

// Dipakai tata usaha dari halaman Data Guru
export const buatAkun = async (data) => {
  const response = await axiosInstance.post('/api/auth/users', data);
  return response.data;
};

export const ubahAkun = async (id, data) => {
  const response = await axiosInstance.patch(`/api/auth/users/${id}`, data);
  return response.data;
};

export const resetPassword = async (id, password) => {
  const response = await axiosInstance.post(`/api/auth/users/${id}/reset-password`, {
    password,
  });
  return response.data;
};

export const fetchMe = async () => {
  const response = await axiosInstance.get('/api/auth/me');
  return response.data;
};

export const uploadFotoProfil = async (file) => {
  const formData = new FormData();
  formData.append('foto', file);
  const response = await axiosInstance.post('/api/auth/me/foto', formData);
  return response.data;
};

export const hapusFotoProfil = async () => {
  const response = await axiosInstance.delete('/api/auth/me/foto');
  return response.data;
};

export const changePassword = async ({ passwordLama, passwordBaru }) => {
  const response = await axiosInstance.post('/api/auth/change-password', {
    passwordLama,
    passwordBaru,
  });
  return response.data;
};
