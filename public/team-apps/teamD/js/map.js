// =====================
// 地図初期化
// =====================

const map = L.map('map').setView(
    [35.681236, 139.767125],
    10
);

L.tileLayer(
    'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    {
        attribution: '&copy; OpenStreetMap'
    }
).addTo(map);


// =====================
// ボランティア募集表示
// =====================

if (typeof volunteerData !== 'undefined') {

    volunteerData.forEach(vol => {
        addVolunteerMarker(vol);
    });

}


// =====================
// ピン表示
// =====================

async function addVolunteerMarker(vol) {

    try {

        console.log(JSON.stringify(vol));

        // DBやThymeleafから混入したダブルクォート除去
        const address = String(vol.location)
            .replaceAll('"', '')
            .trim();

        console.log("検索住所:", address);

        // 国土地理院API
        const response = await fetch(
            `https://msearch.gsi.go.jp/address-search/AddressSearch?q=${encodeURIComponent(address)}`
        );

        const result = await response.json();

        console.log("検索結果:", result);

        if (!result || result.length === 0) {

            console.warn("住所が見つかりません:", address);

            return;
        }

        const lon = result[0].geometry.coordinates[0];
        const lat = result[0].geometry.coordinates[1];

        const formattedDate =
            String(vol.eventDate)
                .replaceAll('"', '')
                .replace('T', ' ')
                .substring(0, 16);

        const marker = L.marker([lat, lon])
            .addTo(map)

            //            .bindPopup(`
            //                <div style="min-width:220px;">
            //                    <h3>${String(vol.title).replaceAll('"', '')}</h3>
            //
            //                    <p>
            //                        📍 ${address}
            //                    </p>
            //
            //                    <p>
            //                        ${String(vol.description).replaceAll('"', '')}
            //                    </p>
            //
            //                    <p>
            //                        応募人数：
            //                        ${vol.currentCount}
            //                        /
            //                        ${vol.capacity}
            //                        人
            //                    </p>
            //
            //
            //					<button
            //					    class="map-detail-btn"
            //					    onclick="location.href='/team_d/volunteer/entry/recruit/${vol.recruitId}'">
            //					    詳細を見る
            //					</button>
            //
            //                </div>
            //            `)
            .bindPopup(`
    <div style="min-width:125px;">


<strong>${vol.title}</strong><br>

   🏠 ${vol.shokudoName}<br>
   📍 ${address}<br>
    📅 ${formattedDate}<br>
   👥 ${vol.currentCount}/${vol.capacity}人<br>
  
       

        <button
            class="map-detail-btn"
            onclick="location.href='./volunteer-recruit-detail.html?id=${vol.recruitId}'">
            詳細を見る
        </button>

    </div>
`)



            .bindTooltip(
                `
			        <strong>${String(vol.title).replaceAll('"', '')}</strong><br>
					
					🏠 ${vol.shokudoName}<br>
					   📍 ${address}<br>
					    📅 ${formattedDate}<br>
					   👥 ${vol.currentCount}/${vol.capacity}人<br>
					  `,


                {
                    direction: "top",
                    offset: [0, -10]
                }
            );

        marker.on('click', function() {
            map.flyTo([lat, lon], 17, {
                duration: 1.5
            });
        });
    } catch (error) {

        console.error("地図表示エラー", error);

    }

}


// =====================
// 住所検索
// =====================

//async function searchMap() {
//
//    const keyword =
//        document.getElementById("searchInput")
//            .value
//            .trim();
//
//    if (!keyword) {
//        return;
//    }
//
//    try {
//
//        const response = await fetch(
//            `https://msearch.gsi.go.jp/address-search/AddressSearch?q=${encodeURIComponent(keyword)}`
//        );
//
//        const result = await response.json();
//
//        if (!result || result.length === 0) {
//
//            alert("住所が見つかりませんでした");
//
//            return;
//        }
//
//        const lon = result[0].geometry.coordinates[0];
//        const lat = result[0].geometry.coordinates[1];
//
//        map.setView([lat, lon], 16);
//
//        L.marker([lat, lon])
//            .addTo(map)
//            .bindPopup(keyword)
//            .openPopup();
//
//
//    } catch (error) {
//
//        console.error("住所検索エラー", error);
//
//    }

async function searchMap() {

    const keyword =
        document.getElementById("searchInput")
            .value
            .trim();

    if (!keyword) {
        return;
    }

    try {

        const response = await fetch(
            `https://msearch.gsi.go.jp/address-search/AddressSearch?q=${encodeURIComponent(keyword)}`
        );

        const result = await response.json();

        if (!result || result.length === 0) {

            alert("住所が見つかりませんでした");

            return;
        }

        const lon = result[0].geometry.coordinates[0];
        const lat = result[0].geometry.coordinates[1];


        let zoom;

        // 都道府県
        if (
            keyword === "東京都" ||
            keyword === "北海道" ||
            keyword === "大阪府" ||
            keyword === "京都府" ||
            keyword.endsWith("県")
        ) {
            zoom = 11;
        }

        // 市区町村
        else if (
            keyword.endsWith("市") ||
            keyword.endsWith("区") ||
            keyword.endsWith("町") ||
            keyword.endsWith("村")
        ) {
            zoom = 13;
        }

        // 詳細住所
        else {
            zoom = 17;
        }

        map.flyTo([lat, lon], zoom, {
            duration: 1.5
        });

    } catch (error) {

        console.error("住所検索エラー", error);

    }


}
// ← searchMap の外に出す
function clearMapSearch() {

    document.getElementById("searchInput").value = "";

    map.flyTo(
        [35.681236, 139.767125],
        10,
        {
            duration: 1.5
        }
    );
}