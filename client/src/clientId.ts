let id = localStorage.getItem('seq_client_id');
if (!id) {
  id = Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
  localStorage.setItem('seq_client_id', id);
}
export const clientId = id as string;
