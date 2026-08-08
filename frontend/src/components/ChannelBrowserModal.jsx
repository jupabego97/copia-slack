import { useEffect, useRef, useState } from "react";
import api, { getErrorMessage } from "../api.js";

export default function ChannelBrowserModal({ open, onClose, onChannelReady }) {
  const [channels, setChannels] = useState([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const nameRef = useRef(null);

  useEffect(() => {
    if (!open) {
      setShowCreate(false);
      setName("");
      setDescription("");
      setError("");
      return;
    }

    const load = async () => {
      setLoading(true);
      setError("");
      try {
        const res = await api.get("/api/channels/explore");
        setChannels(res.data);
      } catch (err) {
        setError(getErrorMessage(err, "No se pudieron cargar los canales."));
      } finally {
        setLoading(false);
      }
    };

    load();
    const esc = (event) => event.key === "Escape" && onClose();
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [open, onClose]);

  useEffect(() => {
    if (showCreate) nameRef.current?.focus();
  }, [showCreate]);

  const joinChannel = async (channel) => {
    setSubmitting(true);
    setError("");
    try {
      const res = await api.post(`/api/channels/${channel.id}/join`);
      onChannelReady(res.data);
      onClose();
    } catch (err) {
      setError(getErrorMessage(err, "No se pudo añadir el canal."));
    } finally {
      setSubmitting(false);
    }
  };

  const createChannel = async (event) => {
    event.preventDefault();
    if (!name.trim() || submitting) return;
    setSubmitting(true);
    setError("");
    try {
      const res = await api.post("/api/channels", {
        name: name.trim(),
        description: description.trim() || null,
      });
      onChannelReady(res.data);
      onClose();
    } catch (err) {
      setError(getErrorMessage(err, "No se pudo crear el canal."));
    } finally {
      setSubmitting(false);
    }
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/70 px-4 py-[8vh]"
      onClick={(event) => event.target === event.currentTarget && onClose()}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="channel-browser-title"
        className="w-full max-w-[620px] overflow-hidden rounded-xl border border-[rgba(255,255,255,0.13)] bg-[#222529] shadow-2xl"
      >
        <header className="flex items-center justify-between border-b border-[rgba(255,255,255,0.1)] px-5 py-4">
          <div>
            <h2 id="channel-browser-title" className="text-[17px] font-extrabold text-white">Explorar canales</h2>
            <p className="mt-1 text-[13px] text-[#9B9EA4]">Encuentra un espacio para cada equipo o proyecto.</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar explorar canales"
            className="flex h-8 w-8 items-center justify-center rounded-md text-[#9B9EA4] hover:bg-white/10 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#36C5F0]"
          >
            <span aria-hidden="true" className="text-xl leading-none">×</span>
          </button>
        </header>

        <div className="p-4">
          {error && <p className="mb-3 rounded-md bg-red-500/10 px-3 py-2 text-sm text-red-300" role="alert">{error}</p>}

          {showCreate ? (
            <form onSubmit={createChannel} className="space-y-4 rounded-lg border border-white/10 bg-[#1A1D21] p-4">
              <div>
                <h3 className="text-[15px] font-bold text-white">Crear un canal</h3>
                <p className="mt-1 text-xs text-[#9B9EA4]">El canal quedará disponible para que otros miembros se unan.</p>
              </div>
              <label className="block text-sm font-semibold text-[#D1D2D3]">
                Nombre
                <input
                  ref={nameRef}
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="ej. proyecto-oriente"
                  maxLength={100}
                  required
                  className="mt-1.5 w-full rounded-md border border-white/15 bg-[#222529] px-3 py-2.5 text-sm text-[#D1D2D3] outline-none placeholder:text-[#6B6F76] focus:border-[#36C5F0] focus:ring-1 focus:ring-[#36C5F0]"
                />
              </label>
              <label className="block text-sm font-semibold text-[#D1D2D3]">
                Descripción <span className="font-normal text-[#6B6F76]">(opcional)</span>
                <textarea
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  placeholder="¿Para qué sirve este canal?"
                  maxLength={255}
                  rows={3}
                  className="mt-1.5 w-full resize-none rounded-md border border-white/15 bg-[#222529] px-3 py-2.5 text-sm text-[#D1D2D3] outline-none placeholder:text-[#6B6F76] focus:border-[#36C5F0] focus:ring-1 focus:ring-[#36C5F0]"
                />
              </label>
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setShowCreate(false)} className="rounded-md px-3 py-2 text-sm font-semibold text-[#9B9EA4] hover:bg-white/10 hover:text-white">Cancelar</button>
                <button type="submit" disabled={submitting || !name.trim()} className="rounded-md bg-[#007A5A] px-3 py-2 text-sm font-bold text-white hover:bg-[#148567] disabled:cursor-not-allowed disabled:opacity-50">
                  {submitting ? "Creando…" : "Crear canal"}
                </button>
              </div>
            </form>
          ) : (
            <>
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-xs font-extrabold uppercase tracking-wider text-[#9B9EA4]">Canales disponibles</h3>
                <button type="button" onClick={() => setShowCreate(true)} className="rounded-md px-2.5 py-1.5 text-xs font-bold text-[#36C5F0] hover:bg-[#36C5F0]/10">+ Crear canal</button>
              </div>
              {loading ? (
                <div className="flex justify-center py-10" role="status" aria-label="Cargando canales">
                  <div className="h-5 w-5 animate-spin rounded-full border-2 border-white/10 border-t-[#9B9EA4]" />
                </div>
              ) : channels.length === 0 ? (
                <div className="rounded-lg border border-dashed border-white/10 px-4 py-8 text-center">
                  <p className="text-sm font-semibold text-[#D1D2D3]">Ya estás en todos los canales.</p>
                  <p className="mt-1 text-xs text-[#6B6F76]">Puedes crear uno nuevo para iniciar una conversación.</p>
                </div>
              ) : (
                <div className="space-y-1">
                  {channels.map((channel) => (
                    <button
                      key={channel.id}
                      type="button"
                      onClick={() => joinChannel(channel)}
                      disabled={submitting}
                      className="flex w-full items-start gap-3 rounded-lg px-3 py-3 text-left hover:bg-white/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#36C5F0] disabled:opacity-50"
                    >
                      <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-white/10 text-base font-bold text-[#9B9EA4]">#</span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-bold text-white">{channel.name}</span>
                        <span className="mt-0.5 block truncate text-xs text-[#9B9EA4]">{channel.description || "Sin descripción"}</span>
                      </span>
                      <span className="text-xs font-bold text-[#36C5F0]">Unirme</span>
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </section>
    </div>
  );
}
