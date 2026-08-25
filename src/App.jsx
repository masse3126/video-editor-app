import { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from 'react-leaflet';

// IMPORT PLUGIN CAPACITOR
import { Geolocation } from '@capacitor/geolocation';
import { Filesystem, Directory } from '@capacitor/filesystem';

import 'leaflet/dist/leaflet.css';
import './App.css';

const RecenterAutomatically = ({ lat, lng }) => {
  const map = useMap();
  useEffect(() => {
    map.setView([lat, lng]);
  }, [lat, lng, map]);
  return null;
}

function App() {
  const [videoFile, setVideoFile] = useState(null);
  const [status, setStatus] = useState('Pilih video untuk memulai');
  const [audioScale, setAudioScale] = useState('0');
  const [deviceModel, setDeviceModel] = useState('Samsung Galaxy S26 Ultra');
  const [location, setLocation] = useState({ lat: -0.7893, lng: 113.9213 });
  
  const [progress, setProgress] = useState(0);
  const [downloadInfo, setDownloadInfo] = useState(null);

  // Otomatis minta izin saat aplikasi pertama dibuka
  useEffect(() => {
    const requestStartupPermissions = async () => {
      try {
        await Geolocation.requestPermissions();
        await Filesystem.requestPermissions();
      } catch (e) {
        console.log('Izin startup dilewati/ditolak:', e);
      }
    };
    requestStartupPermissions();
  }, []);

  const LocationPicker = () => {
    useMapEvents({
      click(e) {
        setLocation({ lat: e.latlng.lat, lng: e.latlng.lng });
      },
    });
    return location ? <Marker position={[location.lat, location.lng]} /> : null;
  };

  const getDeviceLocation = async () => {
    try {
      setStatus('Mengambil lokasi perangkat...');
      const position = await Geolocation.getCurrentPosition({ enableHighAccuracy: true });
      setLocation({
        lat: position.coords.latitude,
        lng: position.coords.longitude
      });
      setStatus('Lokasi perangkat berhasil didapatkan!');
    } catch (error) {
      alert('Gagal mendapatkan lokasi. Pastikan GPS aktif.');
      setStatus('Gagal mengakses GPS.');
    }
  };

  const processVideoOnServer = async () => {
    if (!videoFile) return alert('Pilih video dulu!');
    
    setStatus('Mengunggah video ke server PC...');
    setProgress(25);
    setDownloadInfo(null);

    const formData = new FormData();
    formData.append('video', videoFile);
    formData.append('audioScale', audioScale);
    formData.append('lat', location.lat);
    formData.append('lng', location.lng);
    formData.append('deviceModel', deviceModel);

    try {
      // Tautan Publik Localtunnel
      const SERVER_URL = 'https://cold-mirrors-join.loca.lt/process-video'; 
      
      const response = await fetch(SERVER_URL, {
        method: 'POST',
        headers: {
          'bypass-tunnel-reminder': 'true'
        },
        body: formData,
      });

      if (!response.ok) throw new Error("Server gagal memproses video");

      setProgress(75);
      setStatus('Proses selesai! Mengunduh hasil dari PC...');

      const blob = await response.blob();
      const date = new Date();
      const finalFileName = `Videos_${date.getDate()}_${date.getMonth() + 1}_${date.getFullYear()}_${date.getHours()}${date.getMinutes()}.mp4`;

      setDownloadInfo({ blob, filename: finalFileName });
      setProgress(100);
      setStatus('Berhasil! Silakan klik tombol Simpan di bawah.');

    } catch (error) {
      console.error(error);
      setStatus('Proses Gagal! Pastikan server localtunnel di PC masih menyala.');
      setProgress(0);
    }
  };

  const blobToBase64 = (blob) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        if (typeof reader.result === 'string') {
          resolve(reader.result.split(',')[1]);
        } else {
          reject(new Error("Format data tidak valid."));
        }
      };
      reader.onerror = (err) => reject(err);
      reader.readAsDataURL(blob);
    });
  };

  const saveVideoToDevice = async () => {
    if (!downloadInfo || !downloadInfo.blob) {
      return alert('File video belum siap atau gagal diproses!');
    }

    try {
      setStatus('Meminta izin akses penyimpanan...');
      const permissionCheck = await Filesystem.checkPermissions();
      if (permissionCheck.publicStorage !== 'granted') {
        const req = await Filesystem.requestPermissions();
        if (req.publicStorage !== 'granted') {
          alert('Izin penyimpanan ditolak!');
          setStatus('Penyimpanan dibatalkan.');
          return;
        }
      }

      setStatus('Mengonversi file video...');
      const base64Data = await blobToBase64(downloadInfo.blob);

      setStatus('Menyimpan file ke Penyimpanan...');
      
      await Filesystem.writeFile({
        path: downloadInfo.filename,
        data: base64Data,
        directory: Directory.Documents,
        recursive: true
      });

      alert(`BERHASIL! Video tersimpan di folder Documents HP Anda dengan nama: ${downloadInfo.filename}`);
      setStatus('Video berhasil disimpan ke HP!');

    } catch (error) {
      console.error(error);
      alert('GAGAL MENYIMPAN: ' + error.message);
      setStatus('Gagal menyimpan file.');
    }
  };

  return (
    <div style={{ padding: '20px', fontFamily: 'sans-serif', maxWidth: '600px', margin: 'auto' }}>
      <h2>🛠️ Metadata Video Editor (Online Server)</h2>
      
      <div style={{ marginBottom: '15px', padding: '15px', border: '1px solid #ddd', borderRadius: '8px' }}>
        <label><b>1. Pilih Video:</b></label><br/><br/>
        <input 
          type="file" 
          accept="video/mp4" 
          onChange={(e) => {
            setVideoFile(e.target.files[0]);
            setDownloadInfo(null);
            setProgress(0);
          }} 
        />
      </div>

      <div style={{ marginBottom: '15px' }}>
        <label><b>2. Pilih Lokasi (GPS):</b></label><br/>
        <button onClick={getDeviceLocation} style={{ marginBottom: '10px', padding: '8px 12px', backgroundColor: '#17a2b8', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer' }}>
          📍 Gunakan Lokasi Ponsel Saya
        </button>

        <MapContainer center={[location.lat, location.lng]} zoom={4} style={{ height: '250px', width: '100%', marginTop: '5px', borderRadius: '10px' }}>
          <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
          <LocationPicker />
          <RecenterAutomatically lat={location.lat} lng={location.lng} />
        </MapContainer>
        <small>Lat: {location.lat.toFixed(6)}, Lng: {location.lng.toFixed(6)}</small>
      </div>

      <div style={{ marginBottom: '15px', display: 'flex', gap: '10px' }}>
        <div style={{ flex: 1 }}>
          <label><b>3. Audio:</b></label>
          <select value={audioScale} onChange={(e) => setAudioScale(e.target.value)} style={{ padding: '8px', width: '100%', marginTop: '5px' }}>
            <option value="0">Original</option>
            <option value="1">Skala 1 (Gema)</option>
            <option value="2">Skala 2 (Distorsi)</option>
            <option value="3">Skala 3 (Glitch)</option>
            <option value="4">Skala 4 (Noise)</option>
          </select>
        </div>
        <div style={{ flex: 1 }}>
          <label><b>4. Perangkat (Model 2026):</b></label>
          <select value={deviceModel} onChange={(e) => setDeviceModel(e.target.value)} style={{ padding: '8px', width: '100%', marginTop: '5px' }}>
            <option value="Samsung Galaxy S26 Ultra">Samsung Galaxy S26 Ultra</option>
            <option value="Xiaomi 17 Ultra">Xiaomi 17 Ultra</option>
            <option value="OPPO Find X9 Pro">OPPO Find X9 Pro</option>
            <option value="Vivo V80">Vivo V80</option>
            <option value="OnePlus 15s">OnePlus 15s</option>
          </select>
        </div>
      </div>

      <button onClick={processVideoOnServer} style={{ padding: '15px', width: '100%', backgroundColor: '#007BFF', color: 'white', border: 'none', borderRadius: '5px', fontSize: '16px', fontWeight: 'bold', cursor: 'pointer' }}>
        ⚙️ Kirim ke Server PC & Proses
      </button>

      <div style={{ marginTop: '20px', padding: '15px', border: '1px solid #ddd', borderRadius: '8px', backgroundColor: '#f8f9fa' }}>
        <h4 style={{ margin: '0 0 10px 0' }}>Progres Proses:</h4>
        
        <div style={{ width: '100%', backgroundColor: '#e9ecef', borderRadius: '5px', overflow: 'hidden', height: '20px', marginBottom: '10px' }}>
          <div style={{ height: '100%', backgroundColor: '#28a745', width: `${progress}%`, transition: 'width 0.3s' }}></div>
        </div>
        <p style={{ margin: '0 0 10px 0', fontWeight: 'bold', textAlign: 'center' }}>{progress}%</p>
        
        <p style={{ fontWeight: 'bold', color: status.includes('Gagal') ? 'red' : '#007BFF' }}>
          Status: {status}
        </p>
      </div>

      {downloadInfo && (
        <button 
          onClick={saveVideoToDevice}
          style={{ marginTop: '15px', padding: '15px', width: '100%', backgroundColor: '#28a745', color: 'white', border: 'none', borderRadius: '5px', fontSize: '16px', fontWeight: 'bold', cursor: 'pointer' }}
        >
          ⬇️ Simpan Video ke HP
        </button>
      )}

    </div>
  );
}

export default App;