const config = {
    api: {
        url: 'https://uas.apuraprojects.com/api/',  // local IP for physical device
        // url: 'http://192.168.10.104/uas/api/',
        key: 'UAS_FUELER_APP_2025'
    },
    fontsizes: {
        text: 15,
        title: 20,
        subtitle: 16,
        header: 26,
        small: 13,
        menu: 18,
        button: 16,
        step: 18,
        calculator: 48,
        statValue: 36
    },
    google: {
        apiKey: 'AIzaSyByicflh_u69XeDmmW8Q0ugl2N_Bj8pnCs',
        darkStyle: [
            {
                featureType: "all",
                elementType: "labels.text.fill",
                stylers: [
                { color: "#f1f9f6" }, // using whitelight from your config
                { saturation: -20 },
                { lightness: 10 }
                ]
            },
            {
                featureType: "all",
                elementType: "labels.text.stroke",
                stylers: [
                { visibility: "on" },
                { color: "#1e2422" }, // backgroundDarkLighter
                { weight: 0.5 }
                ]
            },
            {
                featureType: "all",
                elementType: "labels.icon",
                stylers: [{ visibility: "off" }]
            },
            {
                featureType: "administrative",
                elementType: "geometry.fill",
                stylers: [{ color: "#1e2422" }] // backgroundDarkLighter
            },
            {
                featureType: "administrative",
                elementType: "geometry.stroke",
                stylers: [
                { color: "#2b3330" }, // backgroundDarkLighterAccented
                { weight: 0.8 }
                ]
            },
            {
                featureType: "landscape",
                elementType: "geometry",
                stylers: [
                { color: "#38413e" } // backgroundDarkLighterAccentedLighter
                ]
            },
            {
                featureType: "poi",
                elementType: "geometry",
                stylers: [{ color: "#1e2422" }] // backgroundDarkLighter
            },
            {
                featureType: "road.highway",
                elementType: "geometry.fill",
                stylers: [{ color: "#2b3330" }] // backgroundDarkLighterAccented
            },
            {
                featureType: "road.highway",
                elementType: "geometry.stroke",
                stylers: [
                { color: "#38413e" }, // backgroundDarkLighterAccentedLighter
                { weight: 0.3 }
                ]
            },
            {
                featureType: "road.arterial",
                elementType: "geometry",
                stylers: [{ color: "#2b3330" }] // backgroundDarkLighterAccented
            },
            {
                featureType: "road.local",
                elementType: "geometry",
                stylers: [{ color: "#2b3330" }] // backgroundDarkLightestest
            },
            {
                featureType: "transit",
                elementType: "geometry",
                stylers: [{ color: "#1e2422" }] // backgroundDarkLighter
            },
            {
                featureType: "water",
                elementType: "geometry",
                stylers: [{ color: "#262a28" }] // backgroundDarkLightest
            }
            ],
    },
    colors: {
        darker1: 'rgba(0, 0, 0, 0.1)',
        darker3: 'rgba(0, 0, 0, 0.3)',
        darker5: 'rgba(0, 0, 0, 0.5)',
        darker7: 'rgba(0, 0, 0, 0.7)',
        darker9: 'rgba(0, 0, 0, 0.9)',

        lighter05: 'rgba(255, 255, 255, 0.05)',
        lighter1: 'rgba(255, 255, 255, 0.1)',
        lighter3: 'rgba(255, 255, 255, 0.3)',
        lighter5: 'rgba(255, 255, 255, 0.5)',
        lighter9: 'rgba(255, 255, 255, 0.9)',

        transparent: 'transparent',
        
        white: '#FFFFFF',
        darklight: '#4b4b4b',
        dark: '#17191b',
        darker: '#131517',
        darkest: '#0f1113',

        surface: '#202326',
        surfaceRaised: '#282c30',
        surfacePressed: '#32373c',
        border: 'rgba(255, 255, 255, 0.10)',
        textMuted: 'rgba(255, 255, 255, 0.68)',
        tile: '#282c30',

        accent: '#db3131',
        yellowDarker: '#3c2b08',
        yellow: '#f5af18',
        green: '#35c068'
    }
}

export default config;
