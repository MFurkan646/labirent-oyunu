/**
 * OYUN KURULUMU VE CANVAS AYARLARI
 * Canvas, üzerine çizim yapabildiğimiz bir HTML5 alanıdır.
 */
const canvas = document.getElementById('gameCanvas'); // HTML'deki canvas elementini seçiyoruz
const ctx = canvas.getContext('2d'); // Çizim yapmak için 2 boyutlu "fırçamızı" alıyoruz

const GENISLIK = 20;   // Labirentin yatayda kaç kareden oluşacağı
const YUKSEKLIK = 20;  // Labirentin dikeyde kaç kareden oluşacağı
const KARE_BOYUTU = 30; // Her bir kare hücresinin ekrandaki pixel boyutu (30x30px)

// Canvas'ın toplam boyutunu hücre sayısı x hücre boyutu olarak hesaplıyoruz
canvas.width = GENISLIK * KARE_BOYUTU;
canvas.height = YUKSEKLIK * KARE_BOYUTU;

/**
 * ENUMERASYONLAR (SABİT TANIMLAMALAR)
 * Kod içinde "0, 1, 2" gibi sayılar kullanmak yerine anlamlı isimler kullanmamızı sağlar.
 */
const HucreTipi = {
    BOS: 0, DUVAR: 1, BASLANGIC: 2, BITIS: 3,
    YOL_BFS: 4, YOL_DFS: 5, TUZAK: 6, BONUS: 7
};

const Zorluk = { KOLAY: 0, ORTA: 1, ZOR: 2 };

/**
 * GLOBAL DEĞİŞKENLER (OYUNUN DURUMU)
 * Oyunun o anki tüm bilgilerini bu değişkenlerde tutuyoruz.
 */
let harita = [];            // Labirentin 2 boyutlu dizi hali (matris)
let oyuncuX = 1, oyuncuY = 1; // Oyuncunun koordinatları
let adimSayisi = 0, idealAdim = 0; // İstatistik takibi
let zorlukSeviyesi = Zorluk.ORTA;
let selectedDifficulty = Zorluk.ORTA;
let dusmanlar = [];         // Haritadaki düşman nesnelerinin listesi
let oyunSuresi = 0;         // Geçen süre
let zamanLimiti = 60;       // Geri sayım için limit
let enerji = 100;           // Oyuncunun enerjisi
let gorusAlani = 10;        // "Sis" modu için görüş mesafesi
let puanBonusu = 0;         // Toplanan altın/bonus puanlar
let oyunBitti = 0;          // Oyunun durumunu kontrol eden bayrak (0:devam, 1:bitti)
let lastTime = Date.now();  // Zaman farkını hesaplamak için son zaman kaydı
let dusmanTimer = 0;        // Düşman hareketlerini senkronize etmek için
let gameRunning = false;    // Oyun aktif mi duraklatıldı mı?
let gameHistory = [];       // Geçmiş oyunların kayıtları

// Kayıtlı haritaları tutan dizi ve seçili harita indexi
let savedMaps = [];
let selectedMapIndex = -1;

// Turnuva (Tournament) Modu değişkenleri
let tournamentMode = false;
let tournamentPlayers = []; // Turnuvaya katılan oyuncu listesi
let currentPlayerIndex = 0; // Şu an sıra hangi oyuncuda?
let currentRound = 0;       // Kaçıncı turdayız?
let maxRounds = 3;          // Toplam kaç tur oynanacak?

/* ==========================================================================
   HARİTA KAYDETME VE YÜKLEME FONKSİYONLARI
   Bu bölüm, oluşturulan labirentlerin dosyaya kaydedilmesini ve geri yüklenmesini sağlar.
   ========================================================================== */

/**
 * Mevcut haritayı bir JSON dosyası olarak bilgisayara indirir.
 */
function saveCurrentMap() {
    // Harita verilerini derin kopyalama (deep copy) yaparak bir objede topluyoruz
    const mapData = {
        harita: JSON.parse(JSON.stringify(harita)),
        dusmanlar: JSON.parse(JSON.stringify(dusmanlar)),
        zorluk: zorlukSeviyesi,
        tarih: new Date().toLocaleString('tr-TR'), // Kayıt tarihi
        timestamp: Date.now()
    };
    
    savedMaps.push(mapData);
    
    // Tarayıcı üzerinden dosya indirme işlemi başlatıyoruz
    try {
        const mapsJSON = JSON.stringify(savedMaps);
        const blob = new Blob([mapsJSON], {type: 'application/json'}); // Veriyi dosya formatına çeviriyoruz
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a'); // Görünmez bir link oluşturuyoruz
        a.href = url;
        a.download = `harita_${Date.now()}.json`; // Dosya adını belirliyoruz
        a.click(); // Linke otomatik tıklatıp indirmeyi başlatıyoruz
        URL.revokeObjectURL(url); // Belleği temizliyoruz
    } catch(e) {
        console.error('Harita kaydedilemedi:', e);
    }
    
    alert('Harita başarıyla kaydedildi! "Haritalarım" bölümünden görüntüleyebilirsiniz.');
    updateMapsModal();
}

/**
 * Kayıtlı haritaların listelendiği pencereyi (modal) açar.
 */
function showMapsModal() {
    updateMapsModal();
    document.getElementById('mapsModal').style.display = 'flex'; // Modalı görünür yapar
}

/**
 * Kayıtlı haritalar listesini HTML içeriği olarak günceller.
 */
function updateMapsModal() {
    const mapsList = document.getElementById('mapsList');
    
    if(savedMaps.length === 0) {
        mapsList.innerHTML = '<p style="text-align: center; color: #999;">Henüz kayıtlı harita yok.</p>';
    } else {
        let html = '<div style="display: flex; flex-direction: column; gap: 15px;">';
        
        // Kaydedilen her harita için bir liste öğesi oluşturuyoruz
        savedMaps.forEach((map, index) => {
            const zorlukText = map.zorluk === Zorluk.KOLAY ? '😊 Kolay' : 
                              map.zorluk === Zorluk.ORTA ? '😐 Orta' : '😈 Zor';
            
            html += `
                <div class="map-item">
                    <div class="map-info">
                        <div style="font-weight: bold;">🗺️ Harita ${index + 1}</div>
                        <div style="font-size: 12px; color: #666;">📅 ${map.tarih}</div>
                        <div style="font-size: 12px; color: #666;">${zorlukText}</div>
                    </div>
                    <div class="map-actions">
                        <button class="control-btn" onclick="viewMap(${index})">👁️ Görüntüle</button>
                        <button class="control-btn" onclick="playMap(${index})">🎮 Oyna</button>
                        <button class="control-btn" style="background: #ff6b6b; color: white;" onclick="deleteMap(${index})">🗑️</button>
                    </div>
                </div>
            `;
        });
        
        html += '</div>';
        mapsList.innerHTML = html;
    }
}

/**
 * Seçilen haritayı bir önizleme penceresinde çizer.
 * @param {number} index - savedMaps dizisindeki haritanın sırası
 */
function viewMap(index) {
    selectedMapIndex = index;
    const map = savedMaps[index];
    
    document.getElementById('mapViewTitle').textContent = `🗺️ Harita ${index + 1} - ${map.tarih}`;
    
    // Önizleme için ikinci bir canvas kullanıyoruz
    const viewCanvas = document.getElementById('mapViewCanvas');
    const viewCtx = viewCanvas.getContext('2d');
    viewCanvas.width = GENISLIK * KARE_BOYUTU;
    viewCanvas.height = YUKSEKLIK * KARE_BOYUTU;
    
    // Haritadaki hücreleri tipine göre farklı renklerde çiziyoruz
    for(let y = 0; y < YUKSEKLIK; y++) {
        for(let x = 0; x < GENISLIK; x++) {
            let color = 'white';
            switch(map.harita[y][x].tip) {
                case HucreTipi.DUVAR: color = '#505050'; break;
                case HucreTipi.BASLANGIC: color = '#00ff00'; break;
                case HucreTipi.BITIS: color = '#ff0000'; break;
                case HucreTipi.TUZAK: color = '#ff8800'; break;
                case HucreTipi.BONUS: color = '#ffd700'; break;
            }
            viewCtx.fillStyle = color;
            viewCtx.fillRect(x * KARE_BOYUTU, y * KARE_BOYUTU, KARE_BOYUTU, KARE_BOYUTU);
            // Hücrelerin etrafına hafif bir çerçeve çiziyoruz
            viewCtx.strokeStyle = 'rgba(0,0,0,0.1)';
            viewCtx.strokeRect(x * KARE_BOYUTU, y * KARE_BOYUTU, KARE_BOYUTU, KARE_BOYUTU);
        }
    }
    
    // Düşmanları önizlemede kırmızı daireler olarak gösteriyoruz
    for(let d of map.dusmanlar) {
        viewCtx.fillStyle = '#8b0000';
        viewCtx.beginPath();
        viewCtx.arc(d.x * KARE_BOYUTU + KARE_BOYUTU/2,
                   d.y * KARE_BOYUTU + KARE_BOYUTU/2,
                   KARE_BOYUTU/3, 0, Math.PI * 2);
        viewCtx.fill();
    }
    
    closeModal('mapsModal');
    document.getElementById('mapViewModal').style.display = 'flex';
}

/**
 * Önizleme ekranındaki "Oyna" butonu için tetikleyici
 */
function playSelectedMap() {
    playMap(selectedMapIndex);
    closeModal('mapViewModal');
}

/**
 * Seçilen haritayı aktif oyun alanına yükler ve oyunu başlatır.
 */
function playMap(index) {
    const map = savedMaps[index];
    
    // Harita verilerini aktif değişkenlere kopyalıyoruz
    harita = JSON.parse(JSON.stringify(map.harita));
    dusmanlar = JSON.parse(JSON.stringify(map.dusmanlar));
    zorlukSeviyesi = map.zorluk;
    
    closeModal('mapsModal');
    closeModal('mapViewModal');
    
    // Ekranlar arası geçiş yapıyoruz (Giriş ekranını kapat, oyun ekranını aç)
    document.getElementById('welcomeScreen').style.display = 'none';
    document.getElementById('gameScreen').style.display = 'block';
    
    startGame(); // Ana oyun döngüsünü başlatan fonksiyon (başka bir yerde tanımlı olmalı)
}

/**
 * Kayıtlı bir haritayı listeden siler.
 */
function deleteMap(index) {
    if(confirm('Bu haritayı silmek istediğinizden emin misiniz?')) {
        savedMaps.splice(index, 1); // Diziden ilgili kaydı kaldırıyoruz
        updateMapsModal(); // Listeyi tazeliyoruz
    }
}

/* ==========================================================================
   YARIŞMA MODU
   ========================================================================== */

function showTournamentModal() {
    document.getElementById('tournamentSetup').style.display = 'block';
    document.getElementById('tournamentPlayers').style.display = 'none';
    document.getElementById('tournamentProgress').style.display = 'none';
    document.getElementById('tournamentModal').style.display = 'flex';
}

function setupTournamentPlayers() {
    const playerCount = parseInt(document.getElementById('playerCount').value);
    
    if(playerCount < 2 || playerCount > 10) {
        alert('Oyuncu sayısı 2 ile 10 arasında olmalıdır!');
        return;
    }
    
    const inputDiv = document.getElementById('playerNamesInput');
    inputDiv.innerHTML = '';
    
    for(let i = 0; i < playerCount; i++) {
        inputDiv.innerHTML += `
            <div style="margin: 10px 0;">
                <input type="text" id="player${i}" placeholder="Oyuncu ${i + 1} İsmi" 
                       style="padding: 10px; font-size: 16px; border-radius: 10px; border: 2px solid #e0e0e0; width: 100%;">
            </div>
        `;
    }
    
    document.getElementById('tournamentSetup').style.display = 'none';
    document.getElementById('tournamentPlayers').style.display = 'block';
}

function startTournament() {
    const playerCount = parseInt(document.getElementById('playerCount').value);
    tournamentPlayers = [];
    
    for(let i = 0; i < playerCount; i++) {
        const name = document.getElementById(`player${i}`).value.trim();
        if(name === '') {
            alert(`Lütfen Oyuncu ${i + 1} için bir isim girin!`);
            return;
        }
        tournamentPlayers.push({
            name: name,
            scores: [],
            totalScore: 0
        });
    }
    
    tournamentMode = true;
    currentPlayerIndex = 0;
    currentRound = 0;
    
    closeModal('tournamentModal');
    startNextTournamentRound();
}    

function startNextTournamentRound() {
    if(currentRound >= maxRounds) {
        // Tüm turlar bitti, sonuçları göster
        showTournamentResults();
        return;
    }
    
    if(currentPlayerIndex >= tournamentPlayers.length) {
        // Bir tur bitti, sonraki tura geç
        currentPlayerIndex = 0;
        currentRound++;
        if(currentRound >= maxRounds) {
            showTournamentResults();
            return;
        }
    }
    
    // Yeni harita oluştur ve oyunu başlat
    haritaOlustur();
    document.getElementById('welcomeScreen').style.display = 'none';
    document.getElementById('gameScreen').style.display = 'block';
    
    const currentPlayer = tournamentPlayers[currentPlayerIndex];
    alert(`Sıra ${currentPlayer.name}'de! (Tur ${currentRound + 1}/${maxRounds})`);
    
    startGame();
}

function continueToNextRound() {
    closeModal('gameEndModal');
    
    currentPlayerIndex++;
    startNextTournamentRound();
}

function showTournamentResults() {
    tournamentMode = false;
    
    // Toplam puanları hesapla
    tournamentPlayers.forEach(player => {
        player.totalScore = player.scores.reduce((a, b) => a + b, 0);
    });
    
    // QuickSort ile sırala (büyükten küçüğe)
    const sortedPlayers = quickSortPlayers([...tournamentPlayers]);
    
    // Sonuçları göster
    let resultsHTML = '<h2>🏆 Yarışma Sonuçları</h2>';
    resultsHTML += '<div style="margin: 20px 0;">';
    
    sortedPlayers.forEach((player, index) => {
        const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : '🏅';
        resultsHTML += `
            <div class="score-item">
                <span class="score-rank">${medal} ${index + 1}.</span>
                <span>${player.name}</span>
                <span style="font-weight: bold; color: #667eea;">${player.totalScore} puan</span>
            </div>
            <div style="font-size: 12px; color: #666; margin-left: 40px; margin-bottom: 10px;">
                Turlar: ${player.scores.join(', ')}
            </div>
        `;
    });
    
    resultsHTML += '</div>';
    resultsHTML += '<button class="btn btn-primary" onclick="closeModal(\'gameEndModal\'); backToMenu()">Ana Menü</button>';
    
    document.getElementById('endTitle').innerHTML = resultsHTML;
    document.getElementById('endMessage').innerHTML = '';
    document.getElementById('endStats').innerHTML = '';
    document.getElementById('tournamentButtons').style.display = 'none';
    document.getElementById('normalButtons').style.display = 'none';
    
    document.getElementById('gameEndModal').style.display = 'flex';
    
    // Yarışmayı sıfırla
    resetTournament();
}

function resetTournament() {
    tournamentMode = false;
    tournamentPlayers = [];
    currentPlayerIndex = 0;
    currentRound = 0;
    
    document.getElementById('tournamentSetup').style.display = 'block';
    document.getElementById('tournamentPlayers').style.display = 'none';
    document.getElementById('tournamentProgress').style.display = 'none';
    document.getElementById('playerCount').value = 2;
}

// QuickSort için oyuncu sıralama
function quickSortPlayers(arr) {
    if (arr.length <= 1) return arr;

    const pivot = arr[arr.length - 1];
    const left = [];
    const right = [];

    for (let i = 0; i < arr.length - 1; i++) {
        if (arr[i].totalScore > pivot.totalScore) {
            left.push(arr[i]);
        } else {
            right.push(arr[i]);
        }
    }
    return [...quickSortPlayers(left), pivot, ...quickSortPlayers(right)];
}

/* ==========================================================================
   HOCA İÇİN ÖZEL BÖLÜM: VERİ YAPILARI (DATA STRUCTURES)
   ========================================================================== */

/**
 * 1. DENGELİ ARAMA AĞACI (AVL TREE) - SKOR TABLOSU İÇİN
 */
class Node {
    constructor(oyuncuAdi, puan) {
        this.oyuncuAdi = oyuncuAdi;
        this.puan = puan;
        this.left = null;
        this.right = null;
        this.height = 1;
    }
}

class AVLTree {
    constructor() {
        this.root = null;
    }

    getHeight(node) {
        return node ? node.height : 0;
    }

    getBalanceFactor(node) {
        return node ? this.getHeight(node.left) - this.getHeight(node.right) : 0;
    }

    rightRotate(y) {
        let x = y.left;
        let T2 = x.right;
        x.right = y;
        y.left = T2;
        y.height = Math.max(this.getHeight(y.left), this.getHeight(y.right)) + 1;
        x.height = Math.max(this.getHeight(x.left), this.getHeight(x.right)) + 1;
        return x;
    }

    leftRotate(x) {
        let y = x.right;
        let T2 = y.left;
        y.left = x;
        x.right = T2;
        x.height = Math.max(this.getHeight(x.left), this.getHeight(x.right)) + 1;
        y.height = Math.max(this.getHeight(y.left), this.getHeight(y.right)) + 1;
        return y;
    }

    insert(node, oyuncuAdi, puan) {
        if (!node) return new Node(oyuncuAdi, puan);

        if (puan < node.puan) {
            node.left = this.insert(node.left, oyuncuAdi, puan);
        } else if (puan > node.puan) {
            node.right = this.insert(node.right, oyuncuAdi, puan);
        } else {
            return node;
        }

        node.height = 1 + Math.max(this.getHeight(node.left), this.getHeight(node.right));
        let balance = this.getBalanceFactor(node);

        if (balance > 1 && puan < node.left.puan) return this.rightRotate(node);
        if (balance < -1 && puan > node.right.puan) return this.leftRotate(node);
        if (balance > 1 && puan > node.left.puan) {
            node.left = this.leftRotate(node.left);
            return this.rightRotate(node);
        }
        if (balance < -1 && puan < node.right.puan) {
            node.right = this.rightRotate(node.right);
            return this.leftRotate(node);
        }

        return node;
    }

    addScore(oyuncuAdi, puan) {
        this.root = this.insert(this.root, oyuncuAdi, puan);
    }

    inOrderTraversal(node, result = []) {
        if (node) {
            this.inOrderTraversal(node.right, result);
            result.push({ oyuncuAdi: node.oyuncuAdi, puan: node.puan });
            this.inOrderTraversal(node.left, result);
        }
        return result;
    }

    getSortedScores() {
        return this.inOrderTraversal(this.root);
    }
}

const scoreTree = new AVLTree();

/* ==========================================================================
   HOCA İÇİN ÖZEL BÖLÜM: ALGORİTMALAR (ALGORITHMS)
   ========================================================================== */

/**
 * 2. SIRALAMA (SORTING) - QUICKSORT
 */
function quickSort(arr) {
    if (arr.length <= 1) return arr;

    const pivot = arr[arr.length - 1];
    const left = [];
    const right = [];

    for (let i = 0; i < arr.length - 1; i++) {
        if (arr[i].puan > pivot.puan) {
            left.push(arr[i]);
        } else {
            right.push(arr[i]);
        }
    }
    return [...quickSort(left), pivot, ...quickSort(right)];
}

/**
 * 3. ARAMA (SEARCH) - BINARY SEARCH
 */
function binarySearch(arr, targetPuan) {
    let left = 0;
    let right = arr.length - 1;

    while (left <= right) {
        const mid = Math.floor((left + right) / 2);
        
        if (arr[mid].puan === targetPuan) {
            return arr[mid];
        }
        
        if (arr[mid].puan < targetPuan) {
            right = mid - 1;
        } else {
            left = mid + 1;
        }
    }
    return null;
}

/* ==========================================================================
   OYUN MANTIĞI & HARİTA
   ========================================================================== */

function haritaSifirla() {
    for(let y = 0; y < YUKSEKLIK; y++) {
        for(let x = 0; x < GENISLIK; x++) {
            harita[y][x].ziyaretEdildi = false;
            harita[y][x].ebeveyn = null;
            if(harita[y][x].tip >= 4) harita[y][x].tip = HucreTipi.BOS;
        }
    }
}

function dusmanlariOlustur() {
    dusmanlar = [];
    let hedefSayi = zorlukSeviyesi === Zorluk.KOLAY ? 2 : zorlukSeviyesi === Zorluk.ORTA ? 3 : 5;
    const GUVENLI_MESAFE = 6; 

    for(let i = 0; i < hedefSayi; i++) {
        let x, y, deneme = 0;
        let mesafe = 0;
        do {
            x = Math.floor(Math.random() * (GENISLIK - 4)) + 2;
            y = Math.floor(Math.random() * (YUKSEKLIK - 4)) + 2;
            mesafe = Math.abs(x - 1) + Math.abs(y - 1);
            deneme++;
        } while((harita[y][x].tip !== HucreTipi.BOS || (x===1 && y===1) || 
                 (x===GENISLIK-2 && y===YUKSEKLIK-2) || mesafe < GUVENLI_MESAFE) && deneme < 100);
        
        if(deneme < 100) {
            dusmanlar.push({x: x, y: y, aktif: true, yon: Math.floor(Math.random() * 4)});
        }
    }
}

function yolVarMiKontrol() {
    let kuyruk = [{x: 1, y: 1}];
    let ziyaret = new Set();
    ziyaret.add("1,1");
    let dy = [-1, 1, 0, 0];
    let dx = [0, 0, -1, 1];

    while(kuyruk.length > 0) {
        let curr = kuyruk.shift();
        if(curr.x === GENISLIK-2 && curr.y === YUKSEKLIK-2) return true;

        for(let i = 0; i < 4; i++) {
            let ny = curr.y + dy[i];
            let nx = curr.x + dx[i];
            if(nx >= 0 && nx < GENISLIK && ny >= 0 && ny < YUKSEKLIK) {
                let key = nx + "," + ny;
                if(harita[ny][nx].tip !== HucreTipi.DUVAR && !ziyaret.has(key)) {
                    ziyaret.add(key);
                    kuyruk.push({x: nx, y: ny});
                }
            }
        }
    }
    return false;
}

function haritaOlustur() {
    let haritaGecerli = false;
    let denemeSayisi = 0;

    while(!haritaGecerli && denemeSayisi < 100) {
        harita = [];
        let duvarYogunlugu = zorlukSeviyesi === Zorluk.KOLAY ? 18 :
                            zorlukSeviyesi === Zorluk.ORTA ? 22 : 28;
        
        for(let y = 0; y < YUKSEKLIK; y++) {
            harita[y] = [];
            for(let x = 0; x < GENISLIK; x++) {
                let tip = HucreTipi.BOS;
                if(y === 0 || y === YUKSEKLIK-1 || x === 0 || x === GENISLIK-1) tip = HucreTipi.DUVAR;
                else if(Math.random() * 100 < duvarYogunlugu) tip = HucreTipi.DUVAR;
                harita[y][x] = {x: x, y: y, tip: tip, ziyaretEdildi: false, ebeveyn: null};
            }
        }
        
        harita[1][1].tip = HucreTipi.BASLANGIC;
        harita[YUKSEKLIK-2][GENISLIK-2].tip = HucreTipi.BITIS;

        if(yolVarMiKontrol()) haritaGecerli = true;
        else denemeSayisi++;
    }
    
    let tuzakSayi = zorlukSeviyesi === Zorluk.KOLAY ? 3 : zorlukSeviyesi === Zorluk.ORTA ? 5 : 8;
    let bonusSayi = zorlukSeviyesi === Zorluk.KOLAY ? 5 : zorlukSeviyesi === Zorluk.ORTA ? 4 : 3;
    
    for(let i = 0; i < tuzakSayi; i++) {
        let x = Math.floor(Math.random() * (GENISLIK - 4)) + 2;
        let y = Math.floor(Math.random() * (YUKSEKLIK - 4)) + 2;
        if(harita[y][x].tip === HucreTipi.BOS) harita[y][x].tip = HucreTipi.TUZAK;
    }
    
    for(let i = 0; i < bonusSayi; i++) {
        let x = Math.floor(Math.random() * (GENISLIK - 4)) + 2;
        let y = Math.floor(Math.random() * (YUKSEKLIK - 4)) + 2;
        if(harita[y][x].tip === HucreTipi.BOS) harita[y][x].tip = HucreTipi.BONUS;
    }
    
    dusmanlariOlustur();
}

function yoluIsaretle(bitis, tip) {
    if(!bitis) return;
    let iz = bitis.ebeveyn;
    idealAdim = 0;
    while(iz && iz.tip !== HucreTipi.BASLANGIC) {
        iz.tip = tip;
        iz = iz.ebeveyn;
        idealAdim++;
    }
}

/**
 * 4. KISA YOL VE QUEUE KULLANIMI (BFS)
 */
function cozumBFS() {
    haritaSifirla();
    let kuyruk = [];
    let start = harita[1][1];
    start.ziyaretEdildi = true;
    kuyruk.push(start);
    
    let dy = [-1, 1, 0, 0];
    let dx = [0, 0, -1, 1];
    
    while(kuyruk.length > 0) {
        let curr = kuyruk.shift();
        if(curr.tip === HucreTipi.BITIS) {
            yoluIsaretle(curr, HucreTipi.YOL_BFS);
            return;
        }
        
        for(let i = 0; i < 4; i++) {
            let ny = curr.y + dy[i];
            let nx = curr.x + dx[i];
            if(nx >= 0 && nx < GENISLIK && ny >= 0 && ny < YUKSEKLIK) {
                let next = harita[ny][nx];
                if(next.tip !== HucreTipi.DUVAR && !next.ziyaretEdildi) {
                    next.ziyaretEdildi = true;
                    next.ebeveyn = curr;
                    kuyruk.push(next);
                }
            }
        }
    }
}

/**
 * 5. STACK KULLANIMI (DFS)
 */
function cozumDFS() {
    haritaSifirla();
    let stack = [];
    let start = harita[1][1];
    start.ziyaretEdildi = true;
    stack.push(start);
    
    let dy = [-1, 1, 0, 0];
    let dx = [0, 0, -1, 1];
    
    while(stack.length > 0) {
        let curr = stack.pop();
        if(curr.tip === HucreTipi.BITIS) {
            yoluIsaretle(curr, HucreTipi.YOL_DFS);
            return;
        }
        
        for(let i = 0; i < 4; i++) {
            let ny = curr.y + dy[i];
            let nx = curr.x + dx[i];
            if(nx >= 0 && nx < GENISLIK && ny >= 0 && ny < YUKSEKLIK) {
                let next = harita[ny][nx];
                if(next.tip !== HucreTipi.DUVAR && !next.ziyaretEdildi) {
                    next.ziyaretEdildi = true;
                    next.ebeveyn = curr;
                    stack.push(next);
                }
            }
        }
    }
}

function dusmanlariGuncelle() {
    let dx = [0, 0, -1, 1];
    let dy = [-1, 1, 0, 0];
    
    for(let d of dusmanlar) {
        if(!d.aktif) continue;
        let yeniX = d.x + dx[d.yon];
        let yeniY = d.y + dy[d.yon];
        
        if(yeniX > 0 && yeniX < GENISLIK-1 && yeniY > 0 && yeniY < YUKSEKLIK-1 &&
           harita[yeniY][yeniX].tip !== HucreTipi.DUVAR && 
           harita[yeniY][yeniX].tip !== HucreTipi.TUZAK) {
            d.x = yeniX;
            d.y = yeniY;
        } else {
            d.yon = Math.floor(Math.random() * 4);
        }
    }
}

function movePlayer(dx, dy) {
    if(!gameRunning || oyunBitti !== 0) return;
    
    let nX = oyuncuX + dx;
    let nY = oyuncuY + dy;
    
    if(harita[nY][nX].tip !== HucreTipi.DUVAR && enerji > 0) {
        adimSayisi++;
        enerji--;
        oyuncuX = nX;
        oyuncuY = nY;
        
        if(harita[oyuncuY][oyuncuX].tip === HucreTipi.TUZAK) {
            enerji -= 10;
            harita[oyuncuY][oyuncuX].tip = HucreTipi.BOS;
        }
        if(harita[oyuncuY][oyuncuX].tip === HucreTipi.BONUS) {
            enerji += 15;
            puanBonusu += 50;
            harita[oyuncuY][oyuncuX].tip = HucreTipi.BOS;
        }
        
        updateStats();
    }
}

function ciz() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    for(let y = 0; y < YUKSEKLIK; y++) {
        for(let x = 0; x < GENISLIK; x++) {
            let color = 'white';
            
            if(gameRunning) {
                let mesafe = Math.abs(x - oyuncuX) + Math.abs(y - oyuncuY);
                let cozumYoluMu = (harita[y][x].tip === HucreTipi.YOL_BFS || harita[y][x].tip === HucreTipi.YOL_DFS);

                if(mesafe > gorusAlani && !cozumYoluMu) {
                    ctx.fillStyle = 'black';
                    ctx.fillRect(x * KARE_BOYUTU, y * KARE_BOYUTU, KARE_BOYUTU, KARE_BOYUTU);
                    continue;
                }
            }
            
            switch(harita[y][x].tip) {
                case HucreTipi.DUVAR: color = '#505050'; break;
                case HucreTipi.BASLANGIC: color = '#00ff00'; break;
                case HucreTipi.BITIS: color = '#ff0000'; break;
                case HucreTipi.YOL_BFS: color = '#0000ff'; break;
                case HucreTipi.YOL_DFS: color = '#800080'; break;
                case HucreTipi.TUZAK: color = '#ff8800'; break;
                case HucreTipi.BONUS: color = '#ffd700'; break;
            }
            
            ctx.fillStyle = color;
            ctx.fillRect(x * KARE_BOYUTU, y * KARE_BOYUTU, KARE_BOYUTU, KARE_BOYUTU);
            ctx.strokeStyle = 'rgba(0,0,0,0.1)';
            ctx.strokeRect(x * KARE_BOYUTU, y * KARE_BOYUTU, KARE_BOYUTU, KARE_BOYUTU);
        }
    }
    
    if(gameRunning) {
        for(let d of dusmanlar) {
            if(d.aktif) {
                let mesafe = Math.abs(d.x - oyuncuX) + Math.abs(d.y - oyuncuY);
                if(mesafe <= gorusAlani) {
                    ctx.fillStyle = '#8b0000';
                    ctx.beginPath();
                    ctx.arc(d.x * KARE_BOYUTU + KARE_BOYUTU/2,
                           d.y * KARE_BOYUTU + KARE_BOYUTU/2,
                           KARE_BOYUTU/3, 0, Math.PI * 2);
                    ctx.fill();
                }
            }
        }
        
        ctx.fillStyle = '#ffff00';
        ctx.fillRect(oyuncuX * KARE_BOYUTU + 5, oyuncuY * KARE_BOYUTU + 5,
                    KARE_BOYUTU - 10, KARE_BOYUTU - 10);
    }
}

function updateStats() {
    document.getElementById('stepCount').textContent = adimSayisi;
    document.getElementById('energyCount').textContent = enerji;
    document.getElementById('timeCount').textContent = oyunSuresi.toFixed(1);
    document.getElementById('bonusCount').textContent = puanBonusu;
}

function guncelle(deltaTime) {
    if(gameRunning && oyunBitti === 0) {
        oyunSuresi += deltaTime;
        dusmanTimer += deltaTime;
        
        if(dusmanTimer > 0.3) {
            dusmanlariGuncelle();
            dusmanTimer = 0;
        }
        
        for(let d of dusmanlar) {
            if(d.aktif && d.x === oyuncuX && d.y === oyuncuY) {
                oyunBitti = 2;
            }
        }
        
        if(harita[oyuncuY][oyuncuX].tip === HucreTipi.BITIS) {
            oyunBitti = 1;
        }
        
        if(oyunSuresi >= zamanLimiti || enerji <= 0) {
            oyunBitti = 2;
        }
        
        if(oyunBitti !== 0) {
            gameRunning = false;
            showGameEnd();
        }
        
        updateStats();
    }
    ciz();
}

function showDifficultyModal() {
    document.getElementById('difficultyModal').style.display = 'flex';
}

function showScoreModal() {
    updateScoreTable();
    document.getElementById('scoreModal').style.display = 'flex';
}

function showInfoModal() {
    document.getElementById('infoModal').style.display = 'flex';
}

function closeModal(id) {
    document.getElementById(id).style.display = 'none';
}

function selectDifficulty(level) {
    selectedDifficulty = level;
    document.querySelectorAll('.difficulty-card').forEach(card => {
        card.classList.remove('selected');
    });
    document.querySelectorAll('.difficulty-card')[level].classList.add('selected');
}

function startGameWithDifficulty() {
    zorlukSeviyesi = selectedDifficulty;
    closeModal('difficultyModal');
    document.getElementById('welcomeScreen').style.display = 'none';
    document.getElementById('gameScreen').style.display = 'block';
    haritaOlustur();
    startGame();
}

function startGame() {
    oyuncuX = 1;
    oyuncuY = 1;
    adimSayisi = 0;
    oyunSuresi = 0;
    oyunBitti = 0;
    puanBonusu = 0;
    enerji = zorlukSeviyesi === Zorluk.KOLAY ? 150 : 
            zorlukSeviyesi === Zorluk.ORTA ? 100 : 75;
    zamanLimiti = zorlukSeviyesi === Zorluk.KOLAY ? 90 :
                 zorlukSeviyesi === Zorluk.ORTA ? 60 : 45;
    gorusAlani = zorlukSeviyesi === Zorluk.KOLAY ? 15 :
                zorlukSeviyesi === Zorluk.ORTA ? 10 : 6;
    gameRunning = true;
    updateStats();
    ciz();
}

function backToMenu() {
    gameRunning = false;
    document.getElementById('gameScreen').style.display = 'none';
    document.getElementById('welcomeScreen').style.display = 'block';
}

function showGameEnd() {
    const modal = document.getElementById('gameEndModal');
    const title = document.getElementById('endTitle');
    const message = document.getElementById('endMessage');
    const stats = document.getElementById('endStats');
    
    if(oyunBitti === 1) {
        let toplamPuan = (1000 - adimSayisi * 5) + puanBonusu + Math.floor((zamanLimiti - oyunSuresi) * 10);
        if(toplamPuan < 0) toplamPuan = 0;

        title.textContent = '🎉 KAZANDIN!';
        title.style.color = '#00cc00';
        message.textContent = 'Tebrikler! Labirenti başarıyla tamamladın!';
        stats.innerHTML = `
            <div style="font-size: 18px; font-weight: bold; color: #667eea;">Toplam Puan: ${toplamPuan}</div>
            <div style="margin-top: 10px;">Adım Sayısı: ${adimSayisi}</div>
            <div>Süre: ${oyunSuresi.toFixed(1)} saniye</div>
            <div>Bonus: +${puanBonusu}</div>
        `;
        
        // Yarışma modunda mı?
        if(tournamentMode) {
            tournamentPlayers[currentPlayerIndex].scores.push(toplamPuan);
            document.getElementById('tournamentButtons').style.display = 'block';
            document.getElementById('normalButtons').style.display = 'none';
        } else {
            // Normal mod
            scoreTree.addScore('Oyuncu', toplamPuan);
            gameHistory.push({ oyuncuAdi: 'Oyuncu', puan: toplamPuan, tarih: new Date().toLocaleTimeString() });
            document.getElementById('tournamentButtons').style.display = 'none';
            document.getElementById('normalButtons').style.display = 'block';
        }

    } else {
        title.textContent = '😢 OYUN BİTTİ!';
        title.style.color = '#ff6b6b';
        message.textContent = 'Zaman doldu veya enerjin bitti. Tekrar dene!';
        stats.innerHTML = `
            <div>Adım Sayısı: ${adimSayisi}</div>
            <div>Süre: ${oyunSuresi.toFixed(1)} saniye</div>
        `;
        
        // Yarışma modunda kayıp durumu
        if(tournamentMode) {
            tournamentPlayers[currentPlayerIndex].scores.push(0);
            document.getElementById('tournamentButtons').style.display = 'block';
            document.getElementById('normalButtons').style.display = 'none';
        } else {
            document.getElementById('tournamentButtons').style.display = 'none';
            document.getElementById('normalButtons').style.display = 'block';
        }
    }
    
    modal.style.display = 'flex';
}

function updateScoreTable() {
    const table = document.getElementById('scoreTable');
    const sortedScores = scoreTree.getSortedScores();

    if(sortedScores.length === 0) {
        table.innerHTML = '<p style="text-align: center; color: #999;">Henüz skor yok. Oynamaya başlayın!</p>';
    } else {
        let html = '';
        for(let i = 0; i < Math.min(sortedScores.length, 10); i++) {
            html += `
                <div class="score-item">
                    <span class="score-rank">${i+1}.</span>
                    <span>${sortedScores[i].oyuncuAdi}</span>
                    <span style="font-weight: bold; color: #667eea;">${sortedScores[i].puan} puan</span>
                </div>
            `;
        }
        
        html += `
            <div style="margin-top: 20px; display: flex; gap: 10px; justify-content: center; flex-wrap: wrap;">
                <button class="control-btn" onclick="saveScoresToJSON()">💾 Kaydet (JSON)</button>
                <button class="control-btn" onclick="document.getElementById('fileInput').click()">📂 Yükle (JSON)</button>
                <input type="file" id="fileInput" style="display: none;" onchange="loadScoresFromJSON(this)">
                <button class="control-btn" onclick="sortHistoryDemo()">📊 QuickSort Test</button>
            </div>
            <div id="sortResult" style="font-size: 12px; color: #666; margin-top: 10px;"></div>
        `;
        
        table.innerHTML = html;
    }
}

function saveScoresToJSON() {
    const data = JSON.stringify(gameHistory);
    const blob = new Blob([data], {type: 'application/json'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'labirent_skorlar.json';
    a.click();
    URL.revokeObjectURL(url);
}

function loadScoresFromJSON(input) {
    const file = input.files[0];
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const data = JSON.parse(e.target.result);
            gameHistory = data;
            gameHistory.forEach(item => scoreTree.addScore(item.oyuncuAdi, item.puan));
            updateScoreTable();
            alert("Skorlar başarıyla yüklendi!");
        } catch(err) {
            alert("Dosya okuma hatası!");
        }
    };
    reader.readAsText(file);
}

function sortHistoryDemo() {
    const sortedHistory = quickSort([...gameHistory]);
    let resultText = "QuickSort ile sıralandı.<br>";
    if(sortedHistory.length > 0) {
        const topScore = sortedHistory[0].puan;
        const found = binarySearch(sortedHistory, topScore);
        if(found) {
            resultText += `Binary Search: En yüksek puan (${topScore}) bulundu!`;
        }
    }
    document.getElementById('sortResult').innerHTML = resultText;
}

document.addEventListener('keydown', (e) => {
    if(!gameRunning) return;
    
    // Ok tuşlarıyla sayfanın kaymasını engelle
    if(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.key)) {
        e.preventDefault();
    }
    
    switch(e.key) {
        case 'ArrowUp': movePlayer(0, -1); break;
        case 'ArrowDown': movePlayer(0, 1); break;
        case 'ArrowLeft': movePlayer(-1, 0); break;
        case 'ArrowRight': movePlayer(1, 0); break;
    }
});

haritaOlustur();
ciz();

function dongu() {
    let currentTime = Date.now();
    let deltaTime = (currentTime - lastTime) / 1000;
    lastTime = currentTime;
    guncelle(deltaTime);
    requestAnimationFrame(dongu);
}
dongu();