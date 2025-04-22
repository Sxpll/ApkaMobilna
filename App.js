import React, {
    useState,
    useEffect,
    createContext,
    useContext,
    useCallback,
} from "react"; // Dodano useCallback
import {
    NavigationContainer,
    DefaultTheme,
    DarkTheme,
    useNavigation,
    useFocusEffect,
} from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { createDrawerNavigator } from "@react-navigation/drawer";
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    FlatList,
    TextInput,
    Image,
    ScrollView,
    Alert,
    ActivityIndicator,
    Dimensions,
    Modal,
    useColorScheme,
    Linking,
    Platform,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons } from "@expo/vector-icons";
import * as Location from "expo-location";

// Pobieramy wymiary ekranu
const { width, height } = Dimensions.get("window");
// Kontekst dla motywu (ciemny/jasny)
const ThemeContext = createContext();

// Obiekt do tymczasowego przechowywania danych w pamięci aplikacji
const DATA = {
    trips: [],
    photos: [],
    nextTripId: 1,
    nextPhotoId: 1,
    // Metoda do zapisywania danych w AsyncStorage
    saveData: async function () {
        try {
            const dataToSave = {
                trips: this.trips,
                photos: this.photos,
                nextTripId: this.nextTripId,
                nextPhotoId: this.nextPhotoId,
            };
            await AsyncStorage.setItem("appData", JSON.stringify(dataToSave));
        } catch (error) {
            console.error("Błąd zapisywania danych:", error);
        }
    },
    // Metoda do ładowania danych z AsyncStorage
    loadData: async function () {
        try {
            const jsonValue = await AsyncStorage.getItem("appData");
            if (jsonValue != null) {
                const loadedData = JSON.parse(jsonValue);
                this.trips = Array.isArray(loadedData.trips)
                    ? loadedData.trips
                    : [];
                this.photos = Array.isArray(loadedData.photos)
                    ? loadedData.photos
                    : [];
                this.nextTripId = loadedData.nextTripId || 1;
                this.nextPhotoId = loadedData.nextPhotoId || 1;
                return true;
            }
            this.trips = [];
            this.photos = [];
            this.nextTripId = 1;
            this.nextPhotoId = 1;
            return false;
        } catch (error) {
            console.error("Błąd ładowania danych:", error);
            this.trips = [];
            this.photos = [];
            this.nextTripId = 1;
            this.nextPhotoId = 1;
            return false;
        }
    },
};

const Stack = createNativeStackNavigator();
const Drawer = createDrawerNavigator();

// Ekran statystyk
function StatsScreen() {
    const navigation = useNavigation();
    const { isDarkMode } = useContext(ThemeContext);
    const themeStyles = isDarkMode ? darkStyles : lightStyles;
    const [statsData, setStatsData] = useState({
        totalTrips: 0,
        totalPhotos: 0,
        photosPerTrip: "0",
        tripStats: [],
        maxPhotos: 1,
    });
    const [isLoading, setIsLoading] = useState(true);

    // Funkcja obliczająca statystyki (opakowana w useCallback dla stabilności)
    const calculateTripStats = useCallback(() => {
        setIsLoading(true);
        const totalTrips = DATA.trips.length;
        const totalPhotos = DATA.photos.length;
        const photosPerTrip =
            totalTrips > 0 ? (totalPhotos / totalTrips).toFixed(1) : "0";
        const tripStats = DATA.trips.map((trip) => {
            const tripPhotos = DATA.photos.filter((p) => p.tripId === trip.id);
            return { ...trip, photoCount: tripPhotos.length };
        });
        tripStats.sort((a, b) => b.photoCount - a.photoCount);
        const maxPhotos =
            tripStats.length > 0
                ? Math.max(1, ...tripStats.map((t) => t.photoCount))
                : 1;

        setStatsData({
            totalTrips,
            totalPhotos,
            photosPerTrip,
            tripStats,
            maxPhotos,
        });
        setIsLoading(false);
    }, []); // Pusta tablica zależności, bo funkcja zależy tylko od globalnego DATA

    // Efekt do odświeżania statystyk przy fokusie
    useFocusEffect(calculateTripStats);

    const getPhotoCountText = (count) => {
        if (count === 1) return "zdjęcie";
        const rem10 = count % 10,
            rem100 = count % 100;
        if (rem10 >= 2 && rem10 <= 4 && !(rem100 >= 12 && rem100 <= 14))
            return "zdjęcia";
        return "zdjęć";
    };

    if (isLoading) {
        return (
            <View
                style={[
                    styles.container,
                    themeStyles.background,
                    styles.loadingContainer,
                ]}
            >
                <ActivityIndicator size="large" color="#4c8bf5" />
                <Text style={[styles.loadingText, themeStyles.textSecondary]}>
                    Aktualizowanie statystyk...
                </Text>
            </View>
        );
    }

    return (
        <ScrollView style={[styles.container, themeStyles.background]}>
            <View style={[styles.statsCard, themeStyles.card]}>
                <Text style={[styles.statsTitle, themeStyles.title]}>
                    Podsumowanie
                </Text>
                <View style={styles.statsRow}>
                    <View style={styles.statBox}>
                        <Text style={[styles.statValue, themeStyles.text]}>
                            {statsData.totalTrips}
                        </Text>
                        <Text
                            style={[
                                styles.statLabel,
                                themeStyles.textSecondary,
                            ]}
                        >
                            Wycieczki
                        </Text>
                    </View>
                    <View style={styles.statBox}>
                        <Text style={[styles.statValue, themeStyles.text]}>
                            {statsData.totalPhotos}
                        </Text>
                        <Text
                            style={[
                                styles.statLabel,
                                themeStyles.textSecondary,
                            ]}
                        >
                            Zdjęcia
                        </Text>
                    </View>
                    <View style={styles.statBox}>
                        <Text style={[styles.statValue, themeStyles.text]}>
                            {statsData.photosPerTrip}
                        </Text>
                        <Text
                            style={[
                                styles.statLabel,
                                themeStyles.textSecondary,
                            ]}
                        >
                            Zdjęć / wycieczkę
                        </Text>
                    </View>
                </View>
            </View>
            {statsData.tripStats.length > 0 ? (
                <View style={[styles.statsCard, themeStyles.card]}>
                    <Text style={[styles.statsTitle, themeStyles.title]}>
                        Wycieczki wg liczby zdjęć
                    </Text>
                    {statsData.tripStats.map((trip, index) => (
                        <View key={trip.id} style={styles.tripStatItem}>
                            <Text
                                style={[styles.tripStatTitle, themeStyles.text]}
                            >
                                {index + 1}. {trip.title}
                            </Text>
                            <Text
                                style={[
                                    styles.tripStatDate,
                                    themeStyles.textSecondary,
                                ]}
                            >
                                {new Date(trip.date).toLocaleDateString(
                                    "pl-PL"
                                )}
                            </Text>
                            <View style={styles.tripStatPhotoBar}>
                                <View
                                    style={[
                                        styles.tripStatPhotoFill,
                                        {
                                            width: `${Math.min(
                                                100,
                                                (trip.photoCount /
                                                    statsData.maxPhotos) *
                                                    100
                                            )}%`,
                                            backgroundColor: isDarkMode
                                                ? "#4c8bf5"
                                                : "#4c8bf5",
                                        },
                                    ]}
                                />
                                <Text
                                    style={[
                                        styles.tripStatPhotoCount,
                                        themeStyles.text,
                                    ]}
                                >
                                    {trip.photoCount}{" "}
                                    {getPhotoCountText(trip.photoCount)}
                                </Text>
                            </View>
                        </View>
                    ))}
                </View>
            ) : (
                <View style={[styles.statsCard, themeStyles.card]}>
                    <Text
                        style={[
                            styles.emptyStatsText,
                            themeStyles.textSecondary,
                        ]}
                    >
                        Dodaj wycieczki i zdjęcia, aby zobaczyć statystyki.
                    </Text>
                </View>
            )}
        </ScrollView>
    );
}

// Ekran ustawień
function SettingsScreen({ navigation }) {
    // Dodano navigation
    const { isDarkMode } = useContext(ThemeContext);
    const themeStyles = isDarkMode ? darkStyles : lightStyles;

    const handleClearData = () => {
        Alert.alert(
            "Wyczyść dane",
            "Czy na pewno chcesz usunąć WSZYSTKIE wycieczki i zdjęcia? Tej operacji nie można cofnąć.",
            [
                { text: "Anuluj", style: "cancel" },
                {
                    text: "Wyczyść",
                    style: "destructive",
                    onPress: async () => {
                        try {
                            await AsyncStorage.removeItem("appData");
                            DATA.trips = [];
                            DATA.photos = [];
                            DATA.nextTripId = 1;
                            DATA.nextPhotoId = 1;
                            Alert.alert(
                                "Sukces",
                                "Wszystkie dane aplikacji zostały usunięte. Uruchom ponownie aplikację."
                            );
                            // Prostsze może być zrestartowanie aplikacji lub nawigacja do ekranu ładowania,
                            // który przeładuje dane (teraz puste)
                            // navigation.replace('Loading'); // Jeśli masz dostęp do navigation
                        } catch (error) {
                            console.error("Błąd czyszczenia danych:", error);
                            Alert.alert(
                                "Błąd",
                                "Nie udało się wyczyścić danych."
                            );
                        }
                    },
                },
            ],
            { cancelable: true }
        );
    };

    return (
        <View style={[styles.container, themeStyles.background]}>
            <View style={[styles.settingsCard, themeStyles.card]}>
                <Text style={[styles.settingsTitle, themeStyles.title]}>
                    O aplikacji
                </Text>
                <Text style={[styles.aboutText, themeStyles.textSecondary]}>
                    Moje Podróże v1.0.1
                </Text>
                <Text style={[styles.aboutText, themeStyles.textSecondary]}>
                    Aplikacja do przechowywania wspomnień z podróży
                </Text>
                <Text
                    style={[
                        styles.aboutText,
                        themeStyles.textSecondary,
                        { marginTop: 15 },
                    ]}
                >
                    Data kompilacji: {new Date().toLocaleString("pl-PL")}
                </Text>
            </View>
            <View
                style={[
                    styles.settingsCard,
                    themeStyles.card,
                    { marginTop: 20 },
                ]}
            >
                <Text style={[styles.settingsTitle, themeStyles.title]}>
                    Zarządzanie danymi
                </Text>
                <TouchableOpacity
                    style={[styles.button, styles.deleteButton]}
                    onPress={handleClearData}
                    activeOpacity={0.7}
                >
                    <Ionicons
                        name="warning-outline"
                        size={20}
                        color="white"
                        style={{ marginRight: 8 }}
                    />
                    <Text style={styles.deleteButtonText}>
                        Wyczyść wszystkie dane
                    </Text>
                </TouchableOpacity>
                <Text
                    style={[
                        styles.aboutText,
                        themeStyles.textSecondary,
                        { marginTop: 10 },
                    ]}
                >
                    Uwaga: Usunięcie danych jest nieodwracalne.
                </Text>
            </View>
        </View>
    );
}

// Ekran ładowania
function LoadingScreen({ navigation }) {
    const { isDarkMode } = useContext(ThemeContext);
    const themeStyles = isDarkMode ? darkStyles : lightStyles;
    useEffect(() => {
        const load = async () => {
            await DATA.loadData();
            navigation.replace("MainDrawer");
        };
        load();
    }, [navigation]);
    return (
        <View style={[styles.loadingContainer, themeStyles.background]}>
            <ActivityIndicator size="large" color="#4c8bf5" />
            <Text style={[styles.loadingText, themeStyles.textSecondary]}>
                Ładowanie aplikacji...
            </Text>
        </View>
    );
}

// Ekran listy wycieczek
function TripsScreen({ navigation }) {
    const [trips, setTrips] = useState([]); // Inicjalizuj pustą tablicą
    const { isDarkMode } = useContext(ThemeContext);
    const themeStyles = isDarkMode ? darkStyles : lightStyles;

    useFocusEffect(
        useCallback(() => {
            const sortedTrips = [...DATA.trips].sort(
                (a, b) => new Date(b.date) - new Date(a.date)
            );
            setTrips(sortedTrips);
        }, [])
    );

    return (
        <View style={[styles.container, themeStyles.background]}>
            {trips.length === 0 ? (
                <View style={styles.emptyState}>
                    <Ionicons
                        name="map-outline"
                        size={80}
                        color={isDarkMode ? "#555" : "#ccc"}
                    />
                    <Text
                        style={[
                            styles.emptyStateText,
                            themeStyles.textSecondary,
                        ]}
                    >
                        Nie masz jeszcze żadnych wycieczek!{"\n"}Naciśnij '+'
                        aby dodać pierwszą.
                    </Text>
                </View>
            ) : (
                <FlatList
                    data={trips}
                    keyExtractor={(item) => item.id.toString()}
                    renderItem={({ item }) => (
                        <TouchableOpacity
                            style={[styles.tripItem, themeStyles.card]}
                            onPress={() =>
                                navigation.navigate("TripDetails", {
                                    tripId: item.id,
                                })
                            }
                            activeOpacity={0.7}
                        >
                            <Text style={[styles.tripTitle, themeStyles.text]}>
                                {item.title}
                            </Text>
                            <Text
                                style={[
                                    styles.tripDate,
                                    themeStyles.textSecondary,
                                ]}
                            >
                                {new Date(item.date).toLocaleDateString(
                                    "pl-PL"
                                )}
                            </Text>
                            {item.description ? (
                                <Text
                                    style={[
                                        styles.tripDescription,
                                        themeStyles.textSecondary,
                                    ]}
                                    numberOfLines={2}
                                >
                                    {item.description}
                                </Text>
                            ) : null}
                        </TouchableOpacity>
                    )}
                    contentContainerStyle={{ paddingBottom: 80 }}
                />
            )}
            <TouchableOpacity
                style={styles.addButton}
                onPress={() => navigation.navigate("AddTrip")}
                activeOpacity={0.7}
            >
                <Text style={styles.addButtonText}>+</Text>
            </TouchableOpacity>
        </View>
    );
}

// Ekran dodawania wycieczki
function AddTripScreen({ navigation }) {
    const [title, setTitle] = useState("");
    const [description, setDescription] = useState("");
    const { isDarkMode } = useContext(ThemeContext);
    const themeStyles = isDarkMode ? darkStyles : lightStyles;
    const handleAddTrip = async () => {
        const tTitle = title.trim();
        const tDesc = description.trim();
        if (!tTitle) {
            Alert.alert("Błąd", "Nazwa wycieczki jest wymagana.");
            return;
        }
        const newTrip = {
            id: DATA.nextTripId++,
            title: tTitle,
            description: tDesc,
            date: new Date().toISOString(),
        };
        DATA.trips.push(newTrip); // Sortowanie odbędzie się w TripsScreen
        await DATA.saveData();
        Alert.alert("Sukces", "Wycieczka dodana!", [
            {
                text: "OK",
                onPress: () =>
                    navigation.replace("TripDetails", { tripId: newTrip.id }),
            },
        ]);
    };
    return (
        <ScrollView
            style={[styles.container, themeStyles.background]}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.formContainer}
        >
            <View style={styles.form}>
                <Text style={[styles.label, themeStyles.text]}>
                    Nazwa wycieczki*
                </Text>
                <TextInput
                    style={[styles.input, themeStyles.input]}
                    value={title}
                    onChangeText={setTitle}
                    placeholder="Np. Wakacje w Grecji 2025"
                    placeholderTextColor={isDarkMode ? "#888" : "#999"}
                    autoCapitalize="sentences"
                />
                <Text style={[styles.label, themeStyles.text]}>
                    Opis wycieczki (opcjonalnie)
                </Text>
                <TextInput
                    style={[styles.input, styles.textArea, themeStyles.input]}
                    value={description}
                    onChangeText={setDescription}
                    placeholder="Opisz krótko wycieczkę..."
                    placeholderTextColor={isDarkMode ? "#888" : "#999"}
                    multiline
                    numberOfLines={5}
                    textAlignVertical="top"
                    autoCapitalize="sentences"
                />
                <TouchableOpacity
                    style={[
                        styles.button,
                        styles.primaryButton,
                        { marginTop: 20 },
                    ]}
                    onPress={handleAddTrip}
                    activeOpacity={0.7}
                >
                    <Ionicons
                        name="add-circle-outline"
                        size={20}
                        color="white"
                        style={{ marginRight: 8 }}
                    />
                    <Text style={styles.buttonText}>Dodaj wycieczkę</Text>
                </TouchableOpacity>
            </View>
        </ScrollView>
    );
}

// Komponent galerii pełnoekranowej
function PhotoGallery({ photos, initialIndex, onClose }) {
    const [currentIndex, setCurrentIndex] = useState(initialIndex);
    const handlePrevious = () => setCurrentIndex((i) => (i > 0 ? i - 1 : i));
    const handleNext = () =>
        setCurrentIndex((i) => (i < photos.length - 1 ? i + 1 : i));
    const openLocation = (photo) => {
        if (!photo?.location) return;
        const { latitude, longitude } = photo.location;
        const url = Platform.select({
            ios: `maps:0,0?q=${latitude},${longitude}`,
            android: `geo:${latitude},${longitude}?q=${latitude},${longitude}`,
        });
        Linking.openURL(url).catch((e) =>
            Alert.alert("Błąd", "Nie można otworzyć mapy.")
        );
    };
    if (!photos || photos.length === 0) return null;
    const currentPhoto = photos[currentIndex];
    return (
        <Modal
            animationType="fade"
            transparent={true}
            visible={true}
            onRequestClose={onClose}
        >
            <View style={styles.galleryContainer}>
                <TouchableOpacity
                    style={styles.galleryCloseButton}
                    onPress={onClose}
                >
                    <Text style={styles.galleryCloseButtonText}>✕</Text>
                </TouchableOpacity>
                {currentPhoto ? (
                    <Image
                        source={{ uri: currentPhoto.uri }}
                        style={styles.galleryImage}
                        resizeMode="contain"
                    />
                ) : (
                    <View style={styles.galleryImage}>
                        <ActivityIndicator color="white" />
                    </View>
                )}
                <View style={styles.galleryControls}>
                    <TouchableOpacity
                        style={[
                            styles.galleryNavButton,
                            currentIndex === 0 &&
                                styles.galleryNavButtonDisabled,
                        ]}
                        onPress={handlePrevious}
                        disabled={currentIndex === 0}
                        activeOpacity={0.6}
                    >
                        <Text style={styles.galleryNavButtonText}>◀</Text>
                    </TouchableOpacity>
                    <Text style={styles.galleryCounter}>
                        {currentIndex + 1} / {photos.length}
                    </Text>
                    <TouchableOpacity
                        style={[
                            styles.galleryNavButton,
                            currentIndex === photos.length - 1 &&
                                styles.galleryNavButtonDisabled,
                        ]}
                        onPress={handleNext}
                        disabled={currentIndex === photos.length - 1}
                        activeOpacity={0.6}
                    >
                        <Text style={styles.galleryNavButtonText}>▶</Text>
                    </TouchableOpacity>
                </View>
                {currentPhoto?.location && (
                    <TouchableOpacity
                        style={styles.galleryLocationButton}
                        onPress={() => openLocation(currentPhoto)}
                        activeOpacity={0.7}
                    >
                        <Ionicons
                            name="location-outline"
                            size={20}
                            color="white"
                        />
                        <Text style={styles.galleryLocationText}>
                            Zobacz na mapie
                        </Text>
                    </TouchableOpacity>
                )}
                {currentPhoto?.description && (
                    <ScrollView
                        style={styles.galleryDescriptionContainer}
                        nestedScrollEnabled={true}
                    >
                        <Text style={styles.galleryDescription}>
                            {currentPhoto.description}
                        </Text>
                    </ScrollView>
                )}
            </View>
        </Modal>
    );
}

// Ekran szczegółów wycieczki
function TripDetailsScreen({ route, navigation }) {
    const { tripId } = route.params;
    const [trip, setTrip] = useState(null);
    const [photos, setPhotos] = useState([]);
    const [isEditing, setIsEditing] = useState(false);
    const [editTitle, setEditTitle] = useState("");
    const [editDescription, setEditDescription] = useState("");
    const [galleryVisible, setGalleryVisible] = useState(false);
    const [galleryInitialIndex, setGalleryInitialIndex] = useState(0);
    const { isDarkMode } = useContext(ThemeContext);
    const themeStyles = isDarkMode ? darkStyles : lightStyles;
    const [isLoading, setIsLoading] = useState(true);

    const loadTripData = useCallback(() => {
        setIsLoading(true);
        const tripData = DATA.trips.find((t) => t.id === tripId);
        const tripPhotos = DATA.photos
            .filter((p) => p.tripId === tripId)
            .sort((a, b) => new Date(b.date) - new Date(a.date));
        if (tripData) {
            setTrip(tripData);
            setPhotos(tripPhotos);
            if (!isEditing) {
                setEditTitle(tripData.title);
                setEditDescription(tripData.description || "");
            }
            setIsLoading(false);
        } else {
            Alert.alert("Błąd", "Nie znaleziono wybranej wycieczki.", [
                { text: "OK", onPress: () => navigation.goBack() },
            ]);
        }
    }, [tripId, navigation, isEditing]);

    useFocusEffect(loadTripData);

    useEffect(() => {
        if (trip) {
            navigation.setOptions({
                title: isEditing ? "Edytuj wycieczkę" : trip.title,
                headerRight: () => (
                    <TouchableOpacity
                        onPress={() => setIsEditing(!isEditing)}
                        style={{ padding: 5 }}
                        activeOpacity={0.6}
                    >
                        <Text style={styles.headerButton}>
                            {isEditing ? "Anuluj" : "Edytuj"}
                        </Text>
                    </TouchableOpacity>
                ),
            });
        }
        if (!isEditing && trip) {
            setEditTitle(trip.title);
            setEditDescription(trip.description || "");
        }
    }, [trip, navigation, isEditing]);

    const handleDeleteTrip = () =>
        Alert.alert(
            "Usuń wycieczkę",
            `Czy na pewno chcesz usunąć "${trip?.title}"? Zdjęcia (${photos.length}) też zostaną usunięte.`,
            [
                { text: "Anuluj", style: "cancel" },
                {
                    text: "Usuń",
                    style: "destructive",
                    onPress: async () => {
                        DATA.trips = DATA.trips.filter((t) => t.id !== tripId);
                        DATA.photos = DATA.photos.filter(
                            (p) => p.tripId !== tripId
                        );
                        await DATA.saveData();
                        navigation.goBack();
                    },
                },
            ],
            { cancelable: true }
        );
    const handleDeletePhoto = (photoId) =>
        Alert.alert(
            "Usuń zdjęcie",
            "?",
            [
                { text: "Anuluj", style: "cancel" },
                {
                    text: "Usuń",
                    style: "destructive",
                    onPress: async () => {
                        DATA.photos = DATA.photos.filter(
                            (p) => p.id !== photoId
                        );
                        await DATA.saveData();
                        loadTripData();
                        if (
                            galleryVisible &&
                            DATA.photos.filter((p) => p.tripId === tripId)
                                .length === 0
                        )
                            setGalleryVisible(false);
                    },
                },
            ],
            { cancelable: true }
        );
    const openGallery = (index) => {
        setGalleryInitialIndex(index);
        setGalleryVisible(true);
    };
    const openLocation = (photo) => {
        if (!photo?.location) {
            Alert.alert("Brak lokalizacji.");
            return;
        }
        const { latitude, longitude } = photo.location;
        const url = Platform.select({
            ios: `maps:0,0?q=${latitude},${longitude}`,
            android: `geo:${latitude},${longitude}?q=${latitude},${longitude}`,
        });
        Linking.openURL(url).catch((e) =>
            Alert.alert("Błąd", "Nie można otworzyć mapy.")
        );
    };
    const handleSaveChanges = async () => {
        const tTitle = editTitle.trim();
        const tDesc = editDescription.trim();
        if (!tTitle) {
            Alert.alert("Błąd", "Nazwa nie może być pusta.");
            return;
        }
        const i = DATA.trips.findIndex((t) => t.id === tripId);
        if (i !== -1) {
            const updated = {
                ...DATA.trips[i],
                title: tTitle,
                description: tDesc,
            };
            DATA.trips[i] = updated;
            await DATA.saveData();
            setTrip(updated);
            setIsEditing(false);
        } else Alert.alert("Błąd", "Błąd zapisu.");
    };
    const formatDate = (ds) => {
        if (!ds) return "brak daty";
        try {
            const d = new Date(ds);
            if (isNaN(d.getTime())) return "nieprawidłowa data";
            return d.toLocaleDateString("pl-PL", {
                year: "numeric",
                month: "long",
                day: "numeric",
            });
        } catch (e) {
            return "błąd daty";
        }
    };

    if (isLoading) {
        return (
            <View
                style={[
                    styles.container,
                    themeStyles.background,
                    styles.loadingContainer,
                ]}
            >
                <ActivityIndicator size="large" color="#4c8bf5" />
                <Text style={[styles.loadingText, themeStyles.textSecondary]}>
                    Ładowanie...
                </Text>
            </View>
        );
    }

    return (
        <View style={[styles.container, themeStyles.background]}>
            {galleryVisible && photos.length > 0 && (
                <PhotoGallery
                    photos={photos}
                    initialIndex={galleryInitialIndex}
                    onClose={() => setGalleryVisible(false)}
                />
            )}
            <ScrollView
                keyboardShouldPersistTaps="handled"
                contentContainerStyle={{ flexGrow: 1 }}
            >
                {isEditing ? ( // ---- Formularz Edycji ----
                    <View style={styles.form}>
                        <Text style={[styles.label, themeStyles.text]}>
                            Nazwa wycieczki*
                        </Text>
                        <TextInput
                            style={[styles.input, themeStyles.input]}
                            value={editTitle}
                            onChangeText={setEditTitle}
                            placeholder="Nazwa"
                            placeholderTextColor={isDarkMode ? "#888" : "#999"}
                            autoCapitalize="sentences"
                        />
                        <Text style={[styles.label, themeStyles.text]}>
                            Opis wycieczki
                        </Text>
                        <TextInput
                            style={[
                                styles.input,
                                styles.textArea,
                                themeStyles.input,
                            ]}
                            value={editDescription}
                            onChangeText={setEditDescription}
                            placeholder="Opis"
                            placeholderTextColor={isDarkMode ? "#888" : "#999"}
                            multiline
                            numberOfLines={5}
                            textAlignVertical="top"
                            autoCapitalize="sentences"
                        />
                        <TouchableOpacity
                            style={[styles.button, styles.primaryButton]}
                            onPress={handleSaveChanges}
                            activeOpacity={0.7}
                        >
                            <Ionicons
                                name="save-outline"
                                size={20}
                                color="white"
                                style={{ marginRight: 8 }}
                            />
                            <Text style={styles.buttonText}>Zapisz zmiany</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[
                                styles.button,
                                styles.deleteButton,
                                { marginTop: 20 },
                            ]}
                            onPress={handleDeleteTrip}
                            activeOpacity={0.7}
                        >
                            <Ionicons
                                name="trash-outline"
                                size={20}
                                color="white"
                                style={{ marginRight: 8 }}
                            />
                            <Text style={styles.deleteButtonText}>
                                Usuń wycieczkę
                            </Text>
                        </TouchableOpacity>
                    </View>
                ) : (
                    // ---- Widok Szczegółów ----
                    <>
                        <View style={[styles.tripDetails, themeStyles.card]}>
                            <Text
                                style={[
                                    styles.tripDetailDate,
                                    themeStyles.textSecondary,
                                ]}
                            >
                                Data utworzenia: {formatDate(trip?.date)}
                            </Text>
                            {trip?.description ? (
                                <Text
                                    style={[
                                        styles.tripDetailDescription,
                                        themeStyles.text,
                                    ]}
                                >
                                    {trip.description}
                                </Text>
                            ) : (
                                <Text
                                    style={[
                                        styles.tripDetailDescription,
                                        themeStyles.textSecondary,
                                        { fontStyle: "italic" },
                                    ]}
                                >
                                    (Brak opisu)
                                </Text>
                            )}
                        </View>
                        {/* Dodajemy pusty komentarz JSX, aby "wchłonąć" ewentualne białe znaki */}
                        {/* */}
                        <View style={styles.photosSectionHeader}>
                            <Text
                                style={[
                                    styles.photosSectionTitle,
                                    themeStyles.title,
                                ]}
                            >
                                Zdjęcia ({photos.length})
                            </Text>
                        </View>
                        {/* Dodajemy pusty komentarz JSX */}
                        {/* */}
                        {photos.length === 0 ? (
                            <View style={styles.emptyPhotos}>
                                <Ionicons
                                    name="images-outline"
                                    size={60}
                                    color={isDarkMode ? "#555" : "#ccc"}
                                />
                                <Text
                                    style={[
                                        styles.emptyPhotosText,
                                        themeStyles.textSecondary,
                                    ]}
                                >
                                    Brak zdjęć.{"\n"}Dodaj pierwsze naciskając
                                    '+'!
                                </Text>
                            </View>
                        ) : (
                            <View style={styles.photosGrid}>
                                {photos.map((photo, index) => (
                                    <TouchableOpacity
                                        key={photo.id}
                                        style={styles.photoItem}
                                        onPress={() => openGallery(index)}
                                        onLongPress={() =>
                                            handleDeletePhoto(photo.id)
                                        }
                                        delayLongPress={500}
                                        activeOpacity={0.8}
                                    >
                                        <View style={styles.imageContainer}>
                                            <Image
                                                source={{ uri: photo.uri }}
                                                style={styles.photoImage}
                                            />
                                            {photo.location && (
                                                <TouchableOpacity
                                                    style={
                                                        styles.photoLocationIndicatorTouchable
                                                    }
                                                    onPress={(e) => {
                                                        e.stopPropagation();
                                                        openLocation(photo);
                                                    }}
                                                    activeOpacity={0.6}
                                                >
                                                    <View
                                                        style={
                                                            styles.photoLocationIndicator
                                                        }
                                                    >
                                                        <Ionicons
                                                            name="location"
                                                            size={18}
                                                            color="#4c8bf5"
                                                        />
                                                    </View>
                                                </TouchableOpacity>
                                            )}
                                        </View>
                                        {photo.description ? (
                                            <Text
                                                style={[
                                                    styles.photoDescription,
                                                    themeStyles.textSecondary,
                                                ]}
                                                numberOfLines={2}
                                            >
                                                {photo.description}
                                            </Text>
                                        ) : null}
                                    </TouchableOpacity>
                                ))}
                            </View>
                        )}
                    </>
                )}
            </ScrollView>
            {!isEditing && (
                <TouchableOpacity
                    style={styles.addButton}
                    onPress={() => navigation.navigate("AddPhoto", { tripId })}
                    activeOpacity={0.7}
                >
                    <Ionicons name="camera-outline" size={28} color="white" />
                </TouchableOpacity>
            )}
        </View>
    );
}

// Ekran dodawania zdjęcia
function AddPhotoScreen({ route, navigation }) {
    const { tripId } = route.params;
    const [selectedImages, setSelectedImages] = useState([]);
    const [currentImageIndex, setCurrentImageIndex] = useState(0);
    const [descriptions, setDescriptions] = useState({});
    const [locations, setLocations] = useState({});
    const [isGettingLocation, setIsGettingLocation] = useState(false);
    const { isDarkMode } = useContext(ThemeContext);
    const themeStyles = isDarkMode ? darkStyles : lightStyles;
    const getCurrentLocation = async () => {
        if (selectedImages.length === 0) return;
        const uri = selectedImages[currentImageIndex];
        setIsGettingLocation(true);
        try {
            let { status } = await Location.requestForegroundPermissionsAsync();
            if (status !== "granted") {
                Alert.alert("Brak uprawnień", "Brak dostępu do lokalizacji.");
                setIsGettingLocation(false);
                return;
            }
            let loc = await Location.getCurrentPositionAsync({
                accuracy: Location.Accuracy.High,
                timeout: 10000,
            });
            setLocations((prev) => ({
                ...prev,
                [uri]: {
                    latitude: loc.coords.latitude,
                    longitude: loc.coords.longitude,
                },
            }));
            Alert.alert("Sukces", "Lokalizacja dodana!");
        } catch (e) {
            console.error("Błąd lokalizacji:", e);
            let msg = "Błąd lokalizacji.";
            if (e.code === "TIMEOUT") msg = "Timeout lokalizacji.";
            Alert.alert("Błąd", msg);
        } finally {
            setIsGettingLocation(false);
        }
    };
    const removeLocation = () => {
        if (selectedImages.length === 0) return;
        const uri = selectedImages[currentImageIndex];
        if (!locations[uri]) return;
        Alert.alert(
            "Usuń lokalizację",
            "?",
            [
                { text: "Anuluj", style: "cancel" },
                {
                    text: "Usuń",
                    style: "destructive",
                    onPress: () => {
                        setLocations((prev) => {
                            const n = { ...prev };
                            delete n[uri];
                            return n;
                        });
                        Alert.alert("Sukces", "Lokalizacja usunięta.");
                    },
                },
            ],
            { cancelable: true }
        );
    };
    const pickMultipleImages = async () => {
        try {
            const st = await ImagePicker.requestMediaLibraryPermissionsAsync();
            if (st.status !== "granted") {
                Alert.alert("Brak uprawnień", "Brak dostępu do galerii.");
                return;
            }
            const res = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ImagePicker.MediaTypeOptions.Images,
                allowsMultipleSelection: true,
                quality: 0.8,
                exif: true,
                orderedSelection: true,
            });
            if (!res.canceled && res.assets?.length > 0) {
                const uris = res.assets.map((a) => a.uri);
                const locs = {};
                const descs = {};
                res.assets.forEach((a) => {
                    if (a.exif?.GPSLatitude && a.exif?.GPSLongitude)
                        locs[a.uri] = {
                            latitude: a.exif.GPSLatitude,
                            longitude: a.exif.GPSLongitude,
                        };
                    descs[a.uri] = "";
                });
                setSelectedImages(uris);
                setLocations(locs);
                setDescriptions(descs);
                setCurrentImageIndex(0);
            }
        } catch (e) {
            console.error("Błąd wyboru zdjęć:", e);
            Alert.alert("Błąd", "Nie udało się wybrać zdjęć.");
        }
    };
    const takePhoto = async () => {
        try {
            const st = await ImagePicker.requestCameraPermissionsAsync();
            if (st.status !== "granted") {
                Alert.alert("Brak uprawnień", "Brak dostępu do kamery.");
                return;
            }
            const res = await ImagePicker.launchCameraAsync({
                quality: 0.8,
                exif: true,
            });
            if (!res.canceled && res.assets?.length > 0) {
                const a = res.assets[0];
                const uri = a.uri;
                const curLocs = { ...locations };
                const curDescs = { ...descriptions };
                if (a.exif?.GPSLatitude && a.exif?.GPSLongitude)
                    curLocs[uri] = {
                        latitude: a.exif.GPSLatitude,
                        longitude: a.exif.GPSLongitude,
                    };
                curDescs[uri] = "";
                const updatedImgs = [...selectedImages, uri];
                setSelectedImages(updatedImgs);
                setLocations(curLocs);
                setDescriptions(curDescs);
                setCurrentImageIndex(updatedImgs.length - 1);
            }
        } catch (e) {
            console.error("Błąd robienia zdjęcia:", e);
            Alert.alert("Błąd", "Nie udało się zrobić zdjęcia.");
        }
    };
    const handleDescriptionChange = (text) => {
        if (selectedImages.length === 0) return;
        const uri = selectedImages[currentImageIndex];
        setDescriptions((prev) => ({ ...prev, [uri]: text }));
    };
    const goToNextImage = () => {
        if (currentImageIndex < selectedImages.length - 1)
            setCurrentImageIndex((i) => i + 1);
    };
    const goToPreviousImage = () => {
        if (currentImageIndex > 0) setCurrentImageIndex((i) => i - 1);
    };
    const removeCurrentImage = () => {
        if (selectedImages.length === 0) return;
        const uri = selectedImages[currentImageIndex];
        Alert.alert(
            "Usuń zdjęcie",
            "?",
            [
                { text: "Anuluj", style: "cancel" },
                {
                    text: "Usuń",
                    style: "destructive",
                    onPress: () => {
                        const imgs = selectedImages.filter((u) => u !== uri);
                        const d = { ...descriptions };
                        delete d[uri];
                        const l = { ...locations };
                        delete l[uri];
                        setSelectedImages(imgs);
                        setDescriptions(d);
                        setLocations(l);
                        if (imgs.length === 0) setCurrentImageIndex(0);
                        else if (currentImageIndex >= imgs.length)
                            setCurrentImageIndex(imgs.length - 1);
                    },
                },
            ],
            { cancelable: true }
        );
    };
    const openMapForCurrentImage = () => {
        if (selectedImages.length === 0) return;
        const uri = selectedImages[currentImageIndex];
        const loc = locations[uri];
        if (!loc) {
            Alert.alert("Brak lokalizacji.");
            return;
        }
        const url = Platform.select({
            ios: `maps:0,0?q=${loc.latitude},${loc.longitude}`,
            android: `geo:${loc.latitude},${loc.longitude}?q=${loc.latitude},${loc.longitude}`,
        });
        Linking.openURL(url).catch((e) =>
            Alert.alert("Błąd", "Nie można otworzyć mapy.")
        );
    };
    const handleAddPhotos = async () => {
        if (selectedImages.length === 0) {
            Alert.alert("Błąd", "Wybierz zdjęcia.");
            return;
        }
        selectedImages.forEach((uri) => {
            DATA.photos.push({
                id: DATA.nextPhotoId++,
                tripId: tripId,
                uri: uri,
                description: descriptions[uri]?.trim() || "",
                date: new Date().toISOString(),
                location: locations[uri] || null,
            });
        });
        await DATA.saveData();
        const count = selectedImages.length;
        const txt = getPhotoCountText(count);
        Alert.alert("Sukces", `Dodano ${count} ${txt} pomyślnie!`, [
            { text: "OK", onPress: () => navigation.goBack() },
        ]);
    };
    const getPhotoCountText = (c) => {
        if (c === 1) return "zdjęcie";
        const r10 = c % 10,
            r100 = c % 100;
        if (r10 >= 2 && r10 <= 4 && !(r100 >= 12 && r100 <= 14))
            return "zdjęcia";
        return "zdjęć";
    };
    const uri =
        selectedImages.length > 0 ? selectedImages[currentImageIndex] : null;
    const desc = uri ? descriptions[uri] || "" : "";
    const hasLoc = uri && locations[uri];

    return (
        <ScrollView
            style={[styles.container, themeStyles.background]}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ paddingBottom: 100 }}
        >
            <View style={styles.form}>
                <View style={styles.imagePreviewContainer}>
                    {uri ? (
                        <>
                            <Image
                                source={{ uri: uri }}
                                style={styles.imagePreview}
                                resizeMode="contain"
                            />
                            {selectedImages.length > 1 && (
                                <View style={styles.imageCounterContainer}>
                                    <Text style={styles.imageCounter}>
                                        {currentImageIndex + 1}/
                                        {selectedImages.length}
                                    </Text>
                                </View>
                            )}
                            {hasLoc && (
                                <TouchableOpacity
                                    style={styles.locationIndicatorOnPreview}
                                    onPress={openMapForCurrentImage}
                                    onLongPress={removeLocation}
                                    activeOpacity={0.7}
                                >
                                    <Ionicons
                                        name="location"
                                        size={24}
                                        color="#4c8bf5"
                                    />
                                </TouchableOpacity>
                            )}
                        </>
                    ) : (
                        <View
                            style={[styles.imagePlaceholder, themeStyles.card]}
                        >
                            <Ionicons
                                name="image-outline"
                                size={60}
                                color={isDarkMode ? "#555" : "#ccc"}
                            />
                            <Text
                                style={[
                                    styles.imagePlaceholderText,
                                    themeStyles.textSecondary,
                                ]}
                            >
                                Wybierz lub zrób zdjęcie
                            </Text>
                        </View>
                    )}
                </View>
                {/* Dodajemy pusty komentarz JSX */}
                {/* */}
                {selectedImages.length > 0 && (
                    <View style={styles.imageNavigationButtons}>
                        <TouchableOpacity
                            style={[
                                styles.navButton,
                                currentImageIndex === 0 &&
                                    styles.disabledNavButton,
                            ]}
                            onPress={goToPreviousImage}
                            disabled={currentImageIndex === 0}
                            activeOpacity={0.6}
                        >
                            <Ionicons
                                name="chevron-back-outline"
                                size={20}
                                color="white"
                            />
                            <Text style={styles.navButtonText}>Poprzednie</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={styles.removeButton}
                            onPress={removeCurrentImage}
                            activeOpacity={0.7}
                        >
                            <Ionicons
                                name="close-circle-outline"
                                size={20}
                                color="white"
                            />
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[
                                styles.navButton,
                                currentImageIndex ===
                                    selectedImages.length - 1 &&
                                    styles.disabledNavButton,
                            ]}
                            onPress={goToNextImage}
                            disabled={
                                currentImageIndex === selectedImages.length - 1
                            }
                            activeOpacity={0.6}
                        >
                            <Text style={styles.navButtonText}>Następne</Text>
                            <Ionicons
                                name="chevron-forward-outline"
                                size={20}
                                color="white"
                            />
                        </TouchableOpacity>
                    </View>
                )}
                {/* Dodajemy pusty komentarz JSX */}
                {/* */}
                <View style={styles.photoButtons}>
                    <TouchableOpacity
                        style={[styles.button, styles.photoButton]}
                        onPress={takePhoto}
                        activeOpacity={0.7}
                    >
                        <Ionicons
                            name="camera-outline"
                            size={18}
                            color="white"
                            style={{ marginRight: 8 }}
                        />
                        <Text style={styles.buttonText}>Zrób zdjęcie</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.button, styles.photoButton]}
                        onPress={pickMultipleImages}
                        activeOpacity={0.7}
                    >
                        <Ionicons
                            name="images-outline"
                            size={18}
                            color="white"
                            style={{ marginRight: 8 }}
                        />
                        <Text style={styles.buttonText}>Wybierz z galerii</Text>
                    </TouchableOpacity>
                </View>
                {/* Dodajemy pusty komentarz JSX */}
                {/* */}
                {selectedImages.length > 0 && (
                    <>
                        <TouchableOpacity
                            style={[
                                styles.button,
                                styles.locationButton,
                                hasLoc && styles.locationButtonActive,
                                isGettingLocation && styles.disabledButton,
                            ]}
                            onPress={getCurrentLocation}
                            onLongPress={removeLocation}
                            disabled={isGettingLocation}
                            activeOpacity={0.7}
                        >
                            <View style={styles.locationButtonContent}>
                                {isGettingLocation ? (
                                    <ActivityIndicator
                                        size="small"
                                        color="white"
                                        style={styles.locationIcon}
                                    />
                                ) : (
                                    <Ionicons
                                        name={
                                            hasLoc
                                                ? "location"
                                                : "location-outline"
                                        }
                                        size={20}
                                        color="white"
                                        style={styles.locationIcon}
                                    />
                                )}
                                <Text style={styles.buttonText}>
                                    {isGettingLocation
                                        ? "Pobieranie..."
                                        : hasLoc
                                        ? "Lokalizacja dodana (przytrzymaj by usunąć)"
                                        : "Dodaj lokalizację"}
                                </Text>
                            </View>
                        </TouchableOpacity>
                        <Text style={[styles.label, themeStyles.text]}>
                            Opis zdjęcia (opcjonalnie)
                        </Text>
                        <TextInput
                            style={[
                                styles.input,
                                styles.textArea,
                                themeStyles.input,
                            ]}
                            value={desc}
                            onChangeText={handleDescriptionChange}
                            placeholder="Opisz to zdjęcie"
                            placeholderTextColor={isDarkMode ? "#888" : "#999"}
                            multiline
                            numberOfLines={4}
                            textAlignVertical="top"
                            autoCapitalize="sentences"
                        />
                    </>
                )}
                {/* Dodajemy pusty komentarz JSX */}
                {/* */}
                <TouchableOpacity
                    style={[
                        styles.button,
                        styles.primaryButton,
                        styles.finalAddButton,
                        selectedImages.length === 0 && styles.disabledButton,
                    ]}
                    onPress={handleAddPhotos}
                    disabled={selectedImages.length === 0}
                    activeOpacity={0.7}
                >
                    <Ionicons
                        name="checkmark-circle-outline"
                        size={20}
                        color="white"
                        style={{ marginRight: 8 }}
                    />
                    <Text style={styles.buttonText}>
                        {selectedImages.length > 0
                            ? `Dodaj ${
                                  selectedImages.length
                              } ${getPhotoCountText(selectedImages.length)}`
                            : "Dodaj zdjęcia"}
                    </Text>
                </TouchableOpacity>
            </View>
        </ScrollView>
    );
}

// --- Nawigacja ---
function MainStackScreen() {
    const { isDarkMode, toggleTheme } = useContext(ThemeContext);
    return (
        <Stack.Navigator
            screenOptions={({ navigation }) => ({
                headerStyle: {
                    backgroundColor: isDarkMode ? "#222" : "#4c8bf5",
                },
                headerTintColor: "#fff",
                headerTitleStyle: { fontWeight: "bold" },
                headerLeft: () => (
                    <TouchableOpacity
                        style={{ marginLeft: 15, padding: 5 }}
                        onPress={() => navigation.toggleDrawer()}
                        activeOpacity={0.6}
                    >
                        {" "}
                        <Ionicons name="menu" size={24} color="white" />{" "}
                    </TouchableOpacity>
                ),
                headerBackTitleVisible: false,
            })}
        >
            <Stack.Screen
                name="Trips"
                component={TripsScreen}
                options={({ navigation }) => ({
                    title: "Moje Podróże",
                    headerRight: () => (
                        <TouchableOpacity
                            style={{ marginRight: 15, padding: 5 }}
                            onPress={toggleTheme}
                            activeOpacity={0.6}
                        >
                            {" "}
                            <Ionicons
                                name={isDarkMode ? "sunny" : "moon"}
                                size={24}
                                color="white"
                            />{" "}
                        </TouchableOpacity>
                    ),
                })}
            />
            <Stack.Screen
                name="AddTrip"
                component={AddTripScreen}
                options={{ title: "Dodaj wycieczkę" }}
            />
            <Stack.Screen
                name="TripDetails"
                component={TripDetailsScreen}
                options={({ navigation }) => ({
                    title: "Szczegóły wycieczki",
                    headerLeft: () => (
                        <TouchableOpacity
                            style={{ marginLeft: 15, padding: 5 }}
                            onPress={() => navigation.popToTop()}
                            activeOpacity={0.6}
                        >
                            {" "}
                            <Ionicons
                                name="arrow-back"
                                size={24}
                                color="white"
                            />{" "}
                        </TouchableOpacity>
                    ),
                })}
            />
            <Stack.Screen
                name="AddPhoto"
                component={AddPhotoScreen}
                options={{ title: "Dodaj zdjęcie" }}
            />
        </Stack.Navigator>
    );
}
function StatsNavigator() {
    const { isDarkMode } = useContext(ThemeContext);
    return (
        <Stack.Navigator
            screenOptions={({ navigation }) => ({
                headerStyle: {
                    backgroundColor: isDarkMode ? "#222" : "#4c8bf5",
                },
                headerTintColor: "#fff",
                headerTitleStyle: { fontWeight: "bold" },
                headerLeft: () => (
                    <TouchableOpacity
                        style={{ marginLeft: 15, padding: 5 }}
                        onPress={() => navigation.toggleDrawer()}
                        activeOpacity={0.6}
                    >
                        {" "}
                        <Ionicons name="menu" size={24} color="white" />{" "}
                    </TouchableOpacity>
                ),
                headerBackTitleVisible: false,
            })}
        >
            <Stack.Screen
                name="StatsScreen"
                component={StatsScreen}
                options={{ title: "Statystyki" }}
            />
        </Stack.Navigator>
    );
}
// Przekazujemy navigation do SettingsScreen, aby móc zrestartować
function SettingsNavigator({ navigation }) {
    const { isDarkMode } = useContext(ThemeContext);
    return (
        <Stack.Navigator
            screenOptions={({ navigation }) => ({
                headerStyle: {
                    backgroundColor: isDarkMode ? "#222" : "#4c8bf5",
                },
                headerTintColor: "#fff",
                headerTitleStyle: { fontWeight: "bold" },
                headerLeft: () => (
                    <TouchableOpacity
                        style={{ marginLeft: 15, padding: 5 }}
                        onPress={() => navigation.toggleDrawer()}
                        activeOpacity={0.6}
                    >
                        {" "}
                        <Ionicons name="menu" size={24} color="white" />{" "}
                    </TouchableOpacity>
                ),
                headerBackTitleVisible: false,
            })}
        >
            <Stack.Screen
                name="SettingsScreen"
                component={SettingsScreen}
                options={{ title: "Ustawienia" }}
            />
        </Stack.Navigator>
    );
}
function MainDrawerScreen() {
    const { isDarkMode } = useContext(ThemeContext);
    return (
        <Drawer.Navigator
            screenOptions={{
                headerShown: false,
                drawerStyle: { backgroundColor: isDarkMode ? "#222" : "#fff" },
                drawerLabelStyle: {
                    color: isDarkMode ? "#fff" : "#333",
                    marginLeft: 0,
                    fontSize: 16,
                },
                drawerItemStyle: { marginVertical: 5 },
                drawerActiveTintColor: "#4c8bf5",
                drawerInactiveTintColor: isDarkMode ? "#aaa" : "#888",
                drawerActiveBackgroundColor: isDarkMode
                    ? "rgba(76, 139, 245, 0.2)"
                    : "rgba(76, 139, 245, 0.1)",
            }}
        >
            <Drawer.Screen
                name="HomeStack"
                component={MainStackScreen}
                options={{
                    title: "Moje Podróże",
                    drawerIcon: ({ color, size }) => (
                        <Ionicons
                            name="home-outline"
                            size={size}
                            color={color}
                        />
                    ),
                }}
            />
            <Drawer.Screen
                name="StatsStack"
                component={StatsNavigator}
                options={{
                    title: "Statystyki",
                    drawerIcon: ({ color, size }) => (
                        <Ionicons
                            name="bar-chart-outline"
                            size={size}
                            color={color}
                        />
                    ),
                }}
            />
            <Drawer.Screen
                name="SettingsStack"
                component={SettingsNavigator}
                options={{
                    title: "Ustawienia",
                    drawerIcon: ({ color, size }) => (
                        <Ionicons
                            name="settings-outline"
                            size={size}
                            color={color}
                        />
                    ),
                }}
            />
        </Drawer.Navigator>
    );
}
// App Component
export default function App() {
    const [isDarkMode, setIsDarkMode] = useState(false);
    const [isLoadingTheme, setIsLoadingTheme] = useState(true);
    const systemColorScheme = useColorScheme();
    useEffect(() => {
        let mounted = true;
        const load = async () => {
            try {
                const saved = await AsyncStorage.getItem("themePreference");
                if (mounted) {
                    if (saved !== null) setIsDarkMode(saved === "dark");
                    else setIsDarkMode(systemColorScheme === "dark");
                    setIsLoadingTheme(false);
                }
            } catch (e) {
                console.error("Błąd ładowania motywu:", e);
                if (mounted) {
                    setIsDarkMode(systemColorScheme === "dark");
                    setIsLoadingTheme(false);
                }
            }
        };
        load();
        return () => {
            mounted = false;
        };
    }, [systemColorScheme]);
    useEffect(() => {
        if (!isLoadingTheme) {
            const save = async () => {
                try {
                    await AsyncStorage.setItem(
                        "themePreference",
                        isDarkMode ? "dark" : "light"
                    );
                } catch (e) {
                    console.error("Błąd zapisu motywu:", e);
                }
            };
            save();
        }
    }, [isDarkMode, isLoadingTheme]);
    const toggleTheme = () => {
        setIsDarkMode((prev) => !prev);
    };
    const themeContext = { isDarkMode, toggleTheme };
    const navTheme = isDarkMode ? DarkTheme : DefaultTheme;
    if (isLoadingTheme) {
        return (
            <View
                style={{
                    flex: 1,
                    justifyContent: "center",
                    alignItems: "center",
                    backgroundColor:
                        systemColorScheme === "dark" ? "#121212" : "#f5f5f5",
                }}
            >
                <ActivityIndicator size="large" color="#4c8bf5" />
            </View>
        );
    }
    return (
        <ThemeContext.Provider value={themeContext}>
            <NavigationContainer theme={navTheme}>
                <Stack.Navigator
                    initialRouteName="Loading"
                    screenOptions={{ headerShown: false }}
                >
                    <Stack.Screen name="Loading" component={LoadingScreen} />
                    <Stack.Screen
                        name="MainDrawer"
                        component={MainDrawerScreen}
                    />
                </Stack.Navigator>
            </NavigationContainer>
        </ThemeContext.Provider>
    );
}

// --- Style ---
const lightStyles = StyleSheet.create({
    background: { backgroundColor: "#f5f5f5" },
    card: { backgroundColor: "white" },
    title: { color: "#333", fontWeight: "bold" },
    text: { color: "#333" },
    textSecondary: { color: "#666" },
    input: { backgroundColor: "white", color: "#333", borderColor: "#ddd" },
});
const darkStyles = StyleSheet.create({
    background: { backgroundColor: "#121212" },
    card: { backgroundColor: "#222" },
    title: { color: "#fff", fontWeight: "bold" },
    text: { color: "#f0f0f0" },
    textSecondary: { color: "#aaa" },
    input: { backgroundColor: "#333", color: "#f0f0f0", borderColor: "#444" },
});
const styles = StyleSheet.create({
    container: { flex: 1 },
    loadingContainer: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
    },
    loadingText: { marginTop: 12, fontSize: 16 },
    emptyState: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
        padding: 20,
        marginTop: -50,
    },
    emptyStateText: {
        fontSize: 16,
        textAlign: "center",
        marginTop: 15,
        lineHeight: 22,
    },
    tripItem: {
        padding: 16,
        marginHorizontal: 10,
        marginVertical: 6,
        borderRadius: 8,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
        elevation: 3,
    },
    tripTitle: { fontSize: 18, fontWeight: "bold", marginBottom: 4 },
    tripDate: { fontSize: 14, marginBottom: 6 },
    tripDescription: { fontSize: 14 },
    addButton: {
        position: "absolute",
        right: 20,
        bottom: 20,
        width: 60,
        height: 60,
        borderRadius: 30,
        backgroundColor: "#4c8bf5",
        justifyContent: "center",
        alignItems: "center",
        elevation: 5,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 3,
        zIndex: 999,
    },
    addButtonText: { fontSize: 30, color: "white", lineHeight: 35 },
    formContainer: { paddingBottom: 40 },
    form: { padding: 16 },
    label: { fontSize: 16, fontWeight: "bold", marginBottom: 8 },
    input: {
        borderWidth: 1,
        borderRadius: 8,
        paddingHorizontal: 12,
        paddingVertical: 10,
        fontSize: 16,
        marginBottom: 16,
    },
    textArea: { minHeight: 100, textAlignVertical: "top" },
    button: {
        borderRadius: 8,
        paddingVertical: 14,
        paddingHorizontal: 20,
        alignItems: "center",
        marginBottom: 12,
        flexDirection: "row",
        justifyContent: "center",
    },
    primaryButton: { backgroundColor: "#4c8bf5" },
    buttonText: {
        color: "white",
        fontSize: 16,
        fontWeight: "bold",
        textAlign: "center",
    },
    disabledButton: { backgroundColor: "#b0c4de", opacity: 0.7 },
    tripDetails: { padding: 16, margin: 8, borderRadius: 8 },
    tripDetailDate: { fontSize: 14, marginBottom: 8 },
    tripDetailDescription: { fontSize: 16, lineHeight: 24, marginBottom: 16 },
    smallDeleteButton: {
        backgroundColor: "#ff3b30",
        borderRadius: 8,
        paddingVertical: 8,
        paddingHorizontal: 12,
        alignItems: "center",
        alignSelf: "flex-start",
        marginTop: 10,
        flexDirection: "row",
    },
    deleteButton: { backgroundColor: "#ff3b30" },
    deleteButtonText: { color: "white", fontSize: 16, fontWeight: "bold" },
    headerButton: { color: "white", fontSize: 16, fontWeight: "bold" },
    photosSectionHeader: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        paddingHorizontal: 16,
        paddingTop: 20,
        paddingBottom: 8,
    },
    photosSectionTitle: { fontSize: 18 },
    emptyPhotos: { padding: 30, alignItems: "center", marginTop: 20 },
    emptyPhotosText: {
        fontSize: 16,
        textAlign: "center",
        marginTop: 15,
        lineHeight: 22,
    },
    photosGrid: { flexDirection: "row", flexWrap: "wrap", padding: 4 },
    photoItem: { width: "50%", padding: 4 },
    imageContainer: {
        position: "relative",
        borderRadius: 8,
        overflow: "hidden",
    },
    photoImage: {
        width: "100%",
        aspectRatio: 1,
        borderRadius: 8,
        backgroundColor: "#e0e0e0",
    },
    photoLocationIndicatorTouchable: {
        position: "absolute",
        top: 5,
        right: 5,
        padding: 5,
        zIndex: 1,
    },
    photoLocationIndicator: {
        backgroundColor: "rgba(255,255,255,0.8)",
        borderRadius: 12,
        padding: 4,
    },
    photoDescription: {
        paddingHorizontal: 4,
        paddingVertical: 6,
        fontSize: 14,
    },
    imagePreviewContainer: {
        alignItems: "center",
        marginBottom: 16,
        position: "relative",
        minHeight: 200,
        width: "100%",
        backgroundColor: "#e0e0e0",
        borderRadius: 8,
    },
    imagePreview: {
        width: "100%",
        height: 250,
        borderRadius: 8,
        marginBottom: 8,
    },
    imagePlaceholder: {
        width: "100%",
        height: 200,
        borderRadius: 8,
        justifyContent: "center",
        alignItems: "center",
        marginBottom: 8,
        borderWidth: 1,
        borderStyle: "dashed",
        borderColor: "#aaa",
    },
    imagePlaceholderText: { fontSize: 16, marginTop: 10 },
    photoButtons: {
        flexDirection: "row",
        justifyContent: "space-between",
        marginBottom: 20,
    },
    photoButton: { width: "48%", backgroundColor: "#555" },
    locationButton: { backgroundColor: "#5a9c5a", marginBottom: 20 },
    locationButtonActive: { backgroundColor: "#3a7c3a" },
    locationButtonContent: {
        flexDirection: "row",
        justifyContent: "center",
        alignItems: "center",
    },
    locationIcon: { marginRight: 10 },
    locationIndicatorOnPreview: {
        position: "absolute",
        top: 10,
        left: 10,
        backgroundColor: "rgba(255,255,255,0.8)",
        borderRadius: 15,
        padding: 5,
        zIndex: 1,
    },
    imageNavigationButtons: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 16,
    },
    navButton: {
        backgroundColor: "#666",
        paddingVertical: 10,
        paddingHorizontal: 10,
        flex: 0.4,
        marginHorizontal: 3,
        borderRadius: 8,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
    },
    navButtonText: {
        color: "white",
        fontSize: 13,
        fontWeight: "bold",
        marginHorizontal: 3,
    },
    disabledNavButton: { backgroundColor: "#aaa", opacity: 0.7 },
    removeButton: {
        backgroundColor: "#cc0000",
        padding: 10,
        borderRadius: 8,
        marginHorizontal: 3,
        alignItems: "center",
        justifyContent: "center",
    },
    imageCounterContainer: {
        position: "absolute",
        top: 10,
        right: 10,
        backgroundColor: "rgba(0,0,0,0.6)",
        paddingVertical: 4,
        paddingHorizontal: 8,
        borderRadius: 12,
        zIndex: 1,
    },
    imageCounter: { color: "white", fontSize: 12, fontWeight: "bold" },
    finalAddButton: { marginTop: 20 },
    galleryContainer: {
        flex: 1,
        backgroundColor: "rgba(0,0,0,0.95)",
        justifyContent: "center",
        alignItems: "center",
    },
    galleryImage: { width: width, height: height * 0.8 },
    galleryCloseButton: {
        position: "absolute",
        top: Platform.OS === "ios" ? 50 : 30,
        right: 20,
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: "rgba(255,255,255,0.3)",
        justifyContent: "center",
        alignItems: "center",
        zIndex: 10,
    },
    galleryCloseButtonText: {
        color: "white",
        fontSize: 18,
        fontWeight: "bold",
        lineHeight: 20,
    },
    galleryControls: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        width: "90%",
        position: "absolute",
        bottom: 80,
    },
    galleryNavButton: {
        backgroundColor: "rgba(255,255,255,0.3)",
        width: 50,
        height: 50,
        borderRadius: 25,
        justifyContent: "center",
        alignItems: "center",
    },
    galleryNavButtonDisabled: {
        backgroundColor: "rgba(255,255,255,0.1)",
        opacity: 0.6,
    },
    galleryNavButtonText: { color: "white", fontSize: 24, fontWeight: "bold" },
    galleryCounter: { color: "white", fontSize: 16, fontWeight: "bold" },
    galleryLocationButton: {
        position: "absolute",
        bottom: 150,
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: "rgba(0,0,0,0.6)",
        paddingVertical: 8,
        paddingHorizontal: 15,
        borderRadius: 20,
    },
    galleryLocationText: { color: "white", marginLeft: 8, fontSize: 14 },
    galleryDescriptionContainer: {
        position: "absolute",
        bottom: 20,
        width: "90%",
        backgroundColor: "rgba(0,0,0,0.7)",
        padding: 12,
        borderRadius: 8,
        maxHeight: height * 0.15,
    },
    galleryDescription: { color: "white", fontSize: 14, textAlign: "center" },
    statsCard: {
        marginHorizontal: 10,
        marginVertical: 8,
        padding: 16,
        borderRadius: 8,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
        elevation: 3,
    },
    statsTitle: { fontSize: 18, marginBottom: 16 },
    statsRow: {
        flexDirection: "row",
        justifyContent: "space-around",
        marginBottom: 8,
    },
    statBox: { alignItems: "center", padding: 10, minWidth: 80 },
    statValue: { fontSize: 24, fontWeight: "bold" },
    statLabel: { fontSize: 14, marginTop: 4, textAlign: "center" },
    tripStatItem: { marginBottom: 16, paddingBottom: 16 },
    tripStatTitle: { fontSize: 16, fontWeight: "bold", marginBottom: 4 },
    tripStatDate: { fontSize: 14, marginBottom: 8 },
    tripStatPhotoBar: {
        height: 20,
        backgroundColor: "#e0e0e0",
        borderRadius: 10,
        overflow: "hidden",
        position: "relative",
        marginTop: 4,
    },
    tripStatPhotoFill: { height: "100%", borderRadius: 10 },
    tripStatPhotoCount: {
        position: "absolute",
        right: 10,
        top: 0,
        bottom: 0,
        lineHeight: 20,
        fontSize: 12,
        fontWeight: "bold",
        color: "white",
        textShadowColor: "rgba(0, 0, 0, 0.5)",
        textShadowOffset: { width: 0, height: 1 },
        textShadowRadius: 1,
    },
    emptyStatsText: { fontSize: 16, textAlign: "center", padding: 30 },
    settingsCard: {
        marginHorizontal: 10,
        marginVertical: 8,
        padding: 16,
        borderRadius: 8,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
        elevation: 3,
    },
    settingsTitle: { fontSize: 18, marginBottom: 16 },
    settingRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        paddingVertical: 12,
    },
    settingLabel: { fontSize: 16 },
    aboutText: { fontSize: 14, marginTop: 8, lineHeight: 20 },
});
