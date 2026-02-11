import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  View,
  StyleSheet,
  Pressable,
  TextInput,
  ScrollView,
  FlatList,
  ActivityIndicator,
  Alert,
  Keyboard,
  Dimensions,
  Platform,
  Linking,
} from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import * as Location from "expo-location";
import * as Haptics from "expo-haptics";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  interpolate,
} from "react-native-reanimated";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { ThemedText } from "@/components/ThemedText";
import { Card } from "@/components/Card";
import { FasterPickupBanner } from "@/components/FasterPickupBanner";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/hooks/useAuth";
import { apiRequest } from "@/lib/query-client";
import { Colors, Spacing, BorderRadius, Typography, Shadows } from "@/constants/theme";

interface PmgthDriver {
  driverId: string;
  sessionId: string;
  directionScore: number;
  premiumAmount: number;
  premiumPercent: number;
  estimatedPickupMinutes: number;
}

const { width: SCREEN_WIDTH } = Dimensions.get("window");

interface LocationData {
  address: string;
  lat: number;
  lng: number;
}

interface BookingBottomSheetProps {
  currentLocation: { lat: number; lng: number } | null;
  onLocationChange: (pickup: LocationData | null, dropoff: LocationData | null) => void;
  onBookingComplete: (rideId: string) => void;
  bottomInset: number;
}

interface VehicleType {
  id: string;
  name: string;
  type: string;
  baseFare: number;
  perKmRate: number;
  perMinuteRate: number;
  icon: string;
  eta: string;
}

const defaultVehicleTypes: VehicleType[] = [
  { id: "st-economy", name: "Economy", type: "economy", baseFare: 5, perKmRate: 1.5, perMinuteRate: 0.3, icon: "flash-outline", eta: "3 min" },
  { id: "st-comfort", name: "Comfort", type: "comfort", baseFare: 8, perKmRate: 2, perMinuteRate: 0.4, icon: "star-outline", eta: "5 min" },
  { id: "st-premium", name: "Premium", type: "premium", baseFare: 15, perKmRate: 3, perMinuteRate: 0.6, icon: "diamond-outline", eta: "7 min" },
  { id: "st-xl", name: "XL", type: "xl", baseFare: 12, perKmRate: 2.5, perMinuteRate: 0.5, icon: "people-outline", eta: "6 min" },
];

const vehicleIconMap: Record<string, string> = {
  cng: "leaf-outline",
  rickshaw: "bicycle-outline",
  tuktuk: "bicycle-outline",
  moto: "flash-outline",
  economy: "car-outline",
  comfort: "star-outline",
  premium: "diamond-outline",
  xl: "people-outline",
  minibus: "bus-outline",
};

const POPULAR_LOCATIONS_BY_REGION: Record<string, typeof POPULAR_LOCATIONS_UAE> = {};

const POPULAR_LOCATIONS_UAE = [
  // Dubai - Major Landmarks
  { id: "uae-1", address: "Dubai Mall, Downtown Dubai", lat: 25.1972, lng: 55.2744, icon: "cart-outline" },
  { id: "2", address: "Dubai International Airport - Terminal 1", lat: 25.2528, lng: 55.3644, icon: "airplane-outline" },
  { id: "3", address: "Dubai International Airport - Terminal 3", lat: 25.2546, lng: 55.3657, icon: "airplane-outline" },
  { id: "4", address: "Mall of the Emirates, Al Barsha", lat: 25.1181, lng: 55.2001, icon: "cart-outline" },
  { id: "5", address: "Burj Khalifa, Downtown Dubai", lat: 25.1972, lng: 55.2745, icon: "business-outline" },
  { id: "6", address: "Dubai Marina Mall", lat: 25.0763, lng: 55.1405, icon: "cart-outline" },
  { id: "7", address: "Palm Jumeirah, Atlantis The Palm", lat: 25.1304, lng: 55.1171, icon: "home-outline" },
  { id: "8", address: "JBR - Jumeirah Beach Residence", lat: 25.0787, lng: 55.1337, icon: "sunny-outline" },
  { id: "9", address: "DIFC - Dubai International Financial Centre", lat: 25.2117, lng: 55.2788, icon: "business-outline" },
  { id: "10", address: "Dubai Healthcare City", lat: 25.2304, lng: 55.3183, icon: "medkit-outline" },
  { id: "11", address: "Business Bay Metro Station", lat: 25.1871, lng: 55.2619, icon: "train-outline" },
  { id: "12", address: "Ibn Battuta Mall", lat: 25.0469, lng: 55.1179, icon: "cart-outline" },
  { id: "13", address: "City Centre Deira", lat: 25.2519, lng: 55.3311, icon: "cart-outline" },
  { id: "14", address: "Dubai Festival City Mall", lat: 25.2219, lng: 55.3520, icon: "cart-outline" },
  { id: "15", address: "Al Mamzar Beach Park", lat: 25.2889, lng: 55.3491, icon: "sunny-outline" },
  // Dubai - More Areas
  { id: "16", address: "Dubai World Trade Centre", lat: 25.2285, lng: 55.2872, icon: "business-outline" },
  { id: "17", address: "Al Maktoum International Airport (DWC)", lat: 24.8966, lng: 55.1614, icon: "airplane-outline" },
  { id: "18", address: "Dubai Silicon Oasis", lat: 25.1174, lng: 55.3817, icon: "business-outline" },
  { id: "19", address: "International City, Dubai", lat: 25.1614, lng: 55.4119, icon: "home-outline" },
  { id: "20", address: "Dragon Mart, Dubai", lat: 25.1714, lng: 55.4179, icon: "cart-outline" },
  { id: "21", address: "Global Village, Dubai", lat: 25.0704, lng: 55.3069, icon: "sunny-outline" },
  { id: "22", address: "Dubai Sports City", lat: 25.0394, lng: 55.2253, icon: "football-outline" },
  { id: "23", address: "Motor City, Dubai", lat: 25.0483, lng: 55.2411, icon: "home-outline" },
  { id: "24", address: "Jumeirah Village Circle (JVC)", lat: 25.0623, lng: 55.2111, icon: "home-outline" },
  { id: "25", address: "Dubai Investment Park", lat: 24.9844, lng: 55.1533, icon: "business-outline" },
  { id: "26", address: "Al Quoz Industrial Area", lat: 25.1344, lng: 55.2233, icon: "business-outline" },
  { id: "27", address: "Mirdif City Centre", lat: 25.2146, lng: 55.4234, icon: "cart-outline" },
  { id: "28", address: "Al Rashidiya, Dubai", lat: 25.2335, lng: 55.3869, icon: "home-outline" },
  { id: "29", address: "Bur Dubai, Meena Bazaar", lat: 25.2631, lng: 55.2946, icon: "cart-outline" },
  { id: "30", address: "Dubai Hills Mall", lat: 25.1125, lng: 55.2456, icon: "cart-outline" },
  // Abu Dhabi
  { id: "31", address: "Abu Dhabi International Airport", lat: 24.4330, lng: 54.6511, icon: "airplane-outline" },
  { id: "32", address: "Yas Mall, Abu Dhabi", lat: 24.4889, lng: 54.6078, icon: "cart-outline" },
  { id: "33", address: "Ferrari World, Yas Island", lat: 24.4837, lng: 54.6072, icon: "sunny-outline" },
  { id: "34", address: "Sheikh Zayed Grand Mosque, Abu Dhabi", lat: 24.4128, lng: 54.4749, icon: "home-outline" },
  { id: "35", address: "Abu Dhabi Mall", lat: 24.4963, lng: 54.3831, icon: "cart-outline" },
  { id: "36", address: "Marina Mall, Abu Dhabi", lat: 24.4756, lng: 54.3221, icon: "cart-outline" },
  { id: "37", address: "Corniche, Abu Dhabi", lat: 24.4693, lng: 54.3336, icon: "sunny-outline" },
  { id: "38", address: "Saadiyat Island, Abu Dhabi", lat: 24.5371, lng: 54.4341, icon: "sunny-outline" },
  { id: "39", address: "Khalifa City, Abu Dhabi", lat: 24.4217, lng: 54.5692, icon: "home-outline" },
  { id: "40", address: "Al Reem Island, Abu Dhabi", lat: 24.4992, lng: 54.4035, icon: "home-outline" },
  { id: "41", address: "Al Wahda Mall, Abu Dhabi", lat: 24.4679, lng: 54.3716, icon: "cart-outline" },
  { id: "42", address: "Louvre Abu Dhabi, Saadiyat", lat: 24.5337, lng: 54.3983, icon: "sunny-outline" },
  // Sharjah
  { id: "43", address: "Sharjah International Airport", lat: 25.3285, lng: 55.5172, icon: "airplane-outline" },
  { id: "44", address: "Sahara Centre, Sharjah", lat: 25.2969, lng: 55.3900, icon: "cart-outline" },
  { id: "45", address: "City Centre Sharjah", lat: 25.3238, lng: 55.3906, icon: "cart-outline" },
  { id: "46", address: "Al Majaz Waterfront, Sharjah", lat: 25.3358, lng: 55.3870, icon: "sunny-outline" },
  { id: "47", address: "Sharjah Corniche", lat: 25.3556, lng: 55.3906, icon: "sunny-outline" },
  { id: "48", address: "Al Nahda, Sharjah", lat: 25.3086, lng: 55.3700, icon: "home-outline" },
  { id: "49", address: "University City, Sharjah", lat: 25.3066, lng: 55.4717, icon: "school-outline" },
  { id: "50", address: "Muwaileh, Sharjah", lat: 25.3000, lng: 55.4500, icon: "home-outline" },
  // Ajman
  { id: "51", address: "Ajman City Centre", lat: 25.4111, lng: 55.4347, icon: "cart-outline" },
  { id: "52", address: "Ajman Corniche", lat: 25.4167, lng: 55.4333, icon: "sunny-outline" },
  { id: "53", address: "Al Nuaimia, Ajman", lat: 25.3903, lng: 55.4444, icon: "home-outline" },
  // Ras Al Khaimah
  { id: "54", address: "Ras Al Khaimah International Airport", lat: 25.6133, lng: 55.9389, icon: "airplane-outline" },
  { id: "55", address: "Al Hamra Mall, RAK", lat: 25.6847, lng: 55.7847, icon: "cart-outline" },
  { id: "56", address: "RAK Mall", lat: 25.7892, lng: 55.9431, icon: "cart-outline" },
  { id: "57", address: "Jebel Jais, RAK", lat: 25.9556, lng: 56.1333, icon: "sunny-outline" },
  // Fujairah
  { id: "58", address: "Fujairah International Airport", lat: 25.1122, lng: 56.3241, icon: "airplane-outline" },
  { id: "59", address: "Fujairah City Centre", lat: 25.1332, lng: 56.3340, icon: "cart-outline" },
  { id: "60", address: "Fujairah Corniche", lat: 25.1167, lng: 56.3333, icon: "sunny-outline" },
  // Umm Al Quwain
  { id: "61", address: "UAQ Mall, Umm Al Quwain", lat: 25.5647, lng: 55.5547, icon: "cart-outline" },
  { id: "62", address: "Dreamland Aqua Park, UAQ", lat: 25.5800, lng: 55.5536, icon: "sunny-outline" },
  // Al Ain
  { id: "63", address: "Al Ain International Airport", lat: 24.2617, lng: 55.6092, icon: "airplane-outline" },
  { id: "64", address: "Al Ain Mall", lat: 24.2213, lng: 55.7711, icon: "cart-outline" },
  { id: "65", address: "Al Ain Zoo", lat: 24.1697, lng: 55.7431, icon: "sunny-outline" },
  { id: "66", address: "Jebel Hafeet, Al Ain", lat: 24.0631, lng: 55.7764, icon: "sunny-outline" },
  { id: "67", address: "Bawadi Mall, Al Ain", lat: 24.1933, lng: 55.7000, icon: "cart-outline" },
  // More Dubai areas
  { id: "68", address: "Discovery Gardens, Dubai", lat: 25.0397, lng: 55.1361, icon: "home-outline" },
  { id: "69", address: "The Walk at JBR", lat: 25.0785, lng: 55.1339, icon: "sunny-outline" },
  { id: "70", address: "La Mer Beach, Dubai", lat: 25.2259, lng: 55.2639, icon: "sunny-outline" },
  { id: "71", address: "Kite Beach, Dubai", lat: 25.1447, lng: 55.1875, icon: "sunny-outline" },
  { id: "72", address: "City Walk, Dubai", lat: 25.2069, lng: 55.2631, icon: "cart-outline" },
  { id: "73", address: "Bluewaters Island, Dubai", lat: 25.0792, lng: 55.1189, icon: "sunny-outline" },
  { id: "74", address: "Arabian Ranches, Dubai", lat: 25.0500, lng: 55.2667, icon: "home-outline" },
  { id: "75", address: "Damac Hills, Dubai", lat: 25.0367, lng: 55.2450, icon: "home-outline" },
  { id: "76", address: "Emirates Hills, Dubai", lat: 25.0692, lng: 55.1639, icon: "home-outline" },
  { id: "77", address: "The Springs, Dubai", lat: 25.0586, lng: 55.1417, icon: "home-outline" },
  { id: "78", address: "Dubai Creek Harbour", lat: 25.2000, lng: 55.3400, icon: "home-outline" },
  { id: "uae-79", address: "Jumeirah Lakes Towers (JLT)", lat: 25.0750, lng: 55.1450, icon: "business-outline" },
  { id: "uae-80", address: "Dubai Media City", lat: 25.0950, lng: 55.1550, icon: "business-outline" },
];

const POPULAR_LOCATIONS_BD = [
  // Dhaka - Major Landmarks
  { id: "bd-1", address: "Hazrat Shahjalal International Airport, Dhaka", lat: 23.8433, lng: 90.3978, icon: "airplane-outline" },
  { id: "bd-2", address: "Bashundhara City Shopping Mall, Panthapath", lat: 23.7509, lng: 90.3903, icon: "cart-outline" },
  { id: "bd-3", address: "Jamuna Future Park, Kuril", lat: 23.8131, lng: 90.4253, icon: "cart-outline" },
  { id: "bd-4", address: "Gulshan 1 Circle, Dhaka", lat: 23.7808, lng: 90.4169, icon: "business-outline" },
  { id: "bd-5", address: "Gulshan 2 Circle, Dhaka", lat: 23.7936, lng: 90.4145, icon: "business-outline" },
  { id: "bd-6", address: "Banani 11, Dhaka", lat: 23.7937, lng: 90.4066, icon: "business-outline" },
  { id: "bd-7", address: "Dhanmondi 27, Dhaka", lat: 23.7461, lng: 90.3742, icon: "home-outline" },
  { id: "bd-8", address: "Dhanmondi Lake, Dhaka", lat: 23.7465, lng: 90.3763, icon: "sunny-outline" },
  { id: "bd-9", address: "Mirpur 10, Dhaka", lat: 23.8069, lng: 90.3685, icon: "home-outline" },
  { id: "bd-10", address: "Uttara Sector 4, Dhaka", lat: 23.8681, lng: 90.3969, icon: "home-outline" },
  { id: "bd-11", address: "Motijheel Commercial Area, Dhaka", lat: 23.7331, lng: 90.4194, icon: "business-outline" },
  { id: "bd-12", address: "Farmgate, Dhaka", lat: 23.7578, lng: 90.3875, icon: "business-outline" },
  { id: "bd-13", address: "Mohammadpur, Dhaka", lat: 23.7595, lng: 90.3597, icon: "home-outline" },
  { id: "bd-14", address: "Tejgaon Industrial Area, Dhaka", lat: 23.7625, lng: 90.3996, icon: "business-outline" },
  { id: "bd-15", address: "Kawran Bazar, Dhaka", lat: 23.7517, lng: 90.3931, icon: "cart-outline" },
  { id: "bd-16", address: "New Market, Dhaka", lat: 23.7361, lng: 90.3839, icon: "cart-outline" },
  { id: "bd-17", address: "Dhaka Medical College Hospital", lat: 23.7253, lng: 90.3972, icon: "medkit-outline" },
  { id: "bd-18", address: "National Parliament House, Sher-e-Bangla Nagar", lat: 23.7625, lng: 90.3783, icon: "business-outline" },
  { id: "bd-19", address: "Lalbagh Fort, Old Dhaka", lat: 23.7189, lng: 90.3881, icon: "sunny-outline" },
  { id: "bd-20", address: "Ahsanullah University of Science and Technology", lat: 23.7592, lng: 90.3764, icon: "school-outline" },
  // Dhaka - More Areas
  { id: "bd-21", address: "Badda, Dhaka", lat: 23.7806, lng: 90.4282, icon: "home-outline" },
  { id: "bd-22", address: "Mohakhali DOHS, Dhaka", lat: 23.7792, lng: 90.4019, icon: "home-outline" },
  { id: "bd-23", address: "Baridhara DOHS, Dhaka", lat: 23.8063, lng: 90.4214, icon: "home-outline" },
  { id: "bd-24", address: "Bashundhara Residential Area", lat: 23.8125, lng: 90.4347, icon: "home-outline" },
  { id: "bd-25", address: "Keraniganj, Dhaka", lat: 23.6989, lng: 90.3467, icon: "home-outline" },
  { id: "bd-26", address: "Kamalapur Railway Station", lat: 23.7328, lng: 90.4256, icon: "train-outline" },
  { id: "bd-27", address: "Gabtoli Bus Terminal", lat: 23.7778, lng: 90.3450, icon: "bus-outline" },
  { id: "bd-28", address: "Sayedabad Bus Terminal", lat: 23.7175, lng: 90.4250, icon: "bus-outline" },
  { id: "bd-29", address: "Paltan, Dhaka", lat: 23.7358, lng: 90.4128, icon: "business-outline" },
  { id: "bd-30", address: "Khilgaon, Dhaka", lat: 23.7489, lng: 90.4383, icon: "home-outline" },
  // Chittagong
  { id: "bd-31", address: "Shah Amanat International Airport, Chittagong", lat: 22.2492, lng: 91.8133, icon: "airplane-outline" },
  { id: "bd-32", address: "GEC Circle, Chittagong", lat: 22.3569, lng: 91.8222, icon: "business-outline" },
  { id: "bd-33", address: "Agrabad Commercial Area, Chittagong", lat: 22.3233, lng: 91.8083, icon: "business-outline" },
  { id: "bd-34", address: "Chittagong Port", lat: 22.3100, lng: 91.7950, icon: "boat-outline" },
  { id: "bd-35", address: "Patenga Beach, Chittagong", lat: 22.2361, lng: 91.7917, icon: "sunny-outline" },
  { id: "bd-36", address: "Nasirabad Housing, Chittagong", lat: 22.3653, lng: 91.8200, icon: "home-outline" },
  { id: "bd-37", address: "Khulshi, Chittagong", lat: 22.3517, lng: 91.8183, icon: "home-outline" },
  // Sylhet
  { id: "bd-38", address: "Osmani International Airport, Sylhet", lat: 24.9631, lng: 91.8667, icon: "airplane-outline" },
  { id: "bd-39", address: "Zindabazar, Sylhet", lat: 24.8950, lng: 91.8700, icon: "cart-outline" },
  { id: "bd-40", address: "Shahjalal University, Sylhet", lat: 24.9178, lng: 91.8322, icon: "school-outline" },
];

const POPULAR_LOCATIONS_IN = [
  // Mumbai
  { id: "in-1", address: "Chhatrapati Shivaji Maharaj International Airport, Mumbai", lat: 19.0896, lng: 72.8656, icon: "airplane-outline" },
  { id: "in-2", address: "Mumbai Central Railway Station", lat: 18.9693, lng: 72.8197, icon: "train-outline" },
  { id: "in-3", address: "Bandra Kurla Complex (BKC), Mumbai", lat: 19.0596, lng: 72.8656, icon: "business-outline" },
  { id: "in-4", address: "Gateway of India, Mumbai", lat: 18.9220, lng: 72.8347, icon: "sunny-outline" },
  { id: "in-5", address: "Juhu Beach, Mumbai", lat: 19.0936, lng: 72.8266, icon: "sunny-outline" },
  { id: "in-6", address: "Phoenix Marketcity, Kurla", lat: 19.0865, lng: 72.8890, icon: "cart-outline" },
  // Delhi
  { id: "in-7", address: "Indira Gandhi International Airport, Delhi", lat: 28.5562, lng: 77.1000, icon: "airplane-outline" },
  { id: "in-8", address: "Connaught Place, New Delhi", lat: 28.6315, lng: 77.2167, icon: "business-outline" },
  { id: "in-9", address: "India Gate, New Delhi", lat: 28.6129, lng: 77.2295, icon: "sunny-outline" },
  { id: "in-10", address: "Chandni Chowk, Old Delhi", lat: 28.6506, lng: 77.2303, icon: "cart-outline" },
  { id: "in-11", address: "Sarojini Nagar Market, Delhi", lat: 28.5741, lng: 77.1994, icon: "cart-outline" },
  { id: "in-12", address: "Nehru Place, Delhi", lat: 28.5494, lng: 77.2517, icon: "business-outline" },
  // Bangalore
  { id: "in-13", address: "Kempegowda International Airport, Bangalore", lat: 13.1989, lng: 77.7068, icon: "airplane-outline" },
  { id: "in-14", address: "MG Road, Bangalore", lat: 12.9756, lng: 77.6053, icon: "cart-outline" },
  { id: "in-15", address: "Koramangala, Bangalore", lat: 12.9279, lng: 77.6271, icon: "home-outline" },
  { id: "in-16", address: "Whitefield, Bangalore", lat: 12.9698, lng: 77.7500, icon: "business-outline" },
  // Chennai
  { id: "in-17", address: "Chennai International Airport", lat: 12.9941, lng: 80.1709, icon: "airplane-outline" },
  { id: "in-18", address: "Marina Beach, Chennai", lat: 13.0500, lng: 80.2824, icon: "sunny-outline" },
  { id: "in-19", address: "T Nagar, Chennai", lat: 13.0418, lng: 80.2341, icon: "cart-outline" },
  { id: "in-20", address: "Anna Nagar, Chennai", lat: 13.0878, lng: 80.2089, icon: "home-outline" },
  // Kolkata
  { id: "in-21", address: "Netaji Subhas Chandra Bose International Airport, Kolkata", lat: 22.6547, lng: 88.4467, icon: "airplane-outline" },
  { id: "in-22", address: "Park Street, Kolkata", lat: 22.5520, lng: 88.3569, icon: "cart-outline" },
  { id: "in-23", address: "Victoria Memorial, Kolkata", lat: 22.5448, lng: 88.3426, icon: "sunny-outline" },
  { id: "in-24", address: "Salt Lake City, Kolkata", lat: 22.5800, lng: 88.4100, icon: "home-outline" },
];

const POPULAR_LOCATIONS_PK = [
  // Karachi
  { id: "pk-1", address: "Jinnah International Airport, Karachi", lat: 24.9065, lng: 67.1608, icon: "airplane-outline" },
  { id: "pk-2", address: "Clifton Beach, Karachi", lat: 24.8138, lng: 67.0283, icon: "sunny-outline" },
  { id: "pk-3", address: "Dolmen Mall, Karachi", lat: 24.8205, lng: 67.0302, icon: "cart-outline" },
  { id: "pk-4", address: "Saddar, Karachi", lat: 24.8555, lng: 67.0206, icon: "cart-outline" },
  { id: "pk-5", address: "DHA Phase 5, Karachi", lat: 24.8000, lng: 67.0500, icon: "home-outline" },
  { id: "pk-6", address: "Gulshan-e-Iqbal, Karachi", lat: 24.9167, lng: 67.0833, icon: "home-outline" },
  // Lahore
  { id: "pk-7", address: "Allama Iqbal International Airport, Lahore", lat: 31.5216, lng: 74.4039, icon: "airplane-outline" },
  { id: "pk-8", address: "Liberty Market, Lahore", lat: 31.5127, lng: 74.3413, icon: "cart-outline" },
  { id: "pk-9", address: "Packages Mall, Lahore", lat: 31.4697, lng: 74.2728, icon: "cart-outline" },
  { id: "pk-10", address: "Gulberg, Lahore", lat: 31.5117, lng: 74.3461, icon: "home-outline" },
  { id: "pk-11", address: "DHA Phase 6, Lahore", lat: 31.4722, lng: 74.4022, icon: "home-outline" },
  { id: "pk-12", address: "Badshahi Mosque, Lahore", lat: 31.5883, lng: 74.3107, icon: "sunny-outline" },
  // Islamabad
  { id: "pk-13", address: "Islamabad International Airport", lat: 33.5494, lng: 72.8247, icon: "airplane-outline" },
  { id: "pk-14", address: "F-10 Markaz, Islamabad", lat: 33.6997, lng: 73.0250, icon: "cart-outline" },
  { id: "pk-15", address: "Centaurus Mall, Islamabad", lat: 33.7072, lng: 73.0528, icon: "cart-outline" },
  { id: "pk-16", address: "Faisal Mosque, Islamabad", lat: 33.7297, lng: 73.0372, icon: "sunny-outline" },
  { id: "pk-17", address: "Blue Area, Islamabad", lat: 33.7104, lng: 73.0605, icon: "business-outline" },
  { id: "pk-18", address: "G-9 Markaz, Islamabad", lat: 33.6847, lng: 73.0250, icon: "cart-outline" },
];

POPULAR_LOCATIONS_BY_REGION["AE"] = POPULAR_LOCATIONS_UAE;
POPULAR_LOCATIONS_BY_REGION["BD"] = POPULAR_LOCATIONS_BD;
POPULAR_LOCATIONS_BY_REGION["IN"] = POPULAR_LOCATIONS_IN;
POPULAR_LOCATIONS_BY_REGION["PK"] = POPULAR_LOCATIONS_PK;

function detectRegionFromCoordinates(lat: number, lng: number): string {
  if (lat >= 22.5 && lat <= 26.5 && lng >= 88.0 && lng <= 92.5) return "BD";
  if (lat >= 6.0 && lat <= 35.5 && lng >= 68.0 && lng <= 97.5) return "IN";
  if (lat >= 23.5 && lat <= 37.0 && lng >= 60.5 && lng <= 77.5) return "PK";
  if (lat >= 22.0 && lat <= 26.5 && lng >= 51.0 && lng <= 56.5) return "AE";
  if (lat >= 5.5 && lat <= 21.0 && lng >= 97.0 && lng <= 106.0) return "TH";
  if (lat >= 4.5 && lat <= 20.5 && lng >= 95.0 && lng <= 141.5) return "ID";
  if (lat >= 8.0 && lat <= 22.0 && lng >= 102.0 && lng <= 110.0) return "VN";
  if (lat >= 4.5 && lat <= 21.0 && lng >= 116.5 && lng <= 127.0) return "PH";
  if (lat >= 4.0 && lat <= 14.5 && lng >= 2.5 && lng <= 15.0) return "NG";
  if (lat >= -4.5 && lat <= 5.5 && lng >= 33.5 && lng <= 42.0) return "KE";
  return "AE";
}

const paymentMethods = [
  { id: "cash", name: "Cash", icon: "cash-outline", description: "Pay driver directly" },
  { id: "wallet", name: "Wallet", icon: "wallet-outline", description: "Pay from your wallet balance" },
  { id: "usdt", name: "USDT", icon: "logo-bitcoin", description: "Pay with crypto (0.5% fee)" },
];

type TabType = "location" | "rides" | "confirm";

export default function BookingBottomSheet({
  currentLocation,
  onLocationChange,
  onBookingComplete,
  bottomInset,
}: BookingBottomSheetProps) {
  const { theme } = useTheme();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<TabType>("location");
  const [pickupLocation, setPickupLocation] = useState<LocationData | null>(null);
  const [dropoffLocation, setDropoffLocation] = useState<LocationData | null>(null);
  const [pickupSearch, setPickupSearch] = useState("");
  const [dropoffSearch, setDropoffSearch] = useState("");
  const [activeInput, setActiveInput] = useState<"pickup" | "dropoff" | null>(null);
  const [selectedVehicle, setSelectedVehicle] = useState<VehicleType>(defaultVehicleTypes[0]);
  const [selectedPayment, setSelectedPayment] = useState(paymentMethods[0]);
  const [isGettingLocation, setIsGettingLocation] = useState(false);
  const [selectedPmgthDriver, setSelectedPmgthDriver] = useState<PmgthDriver | null>(null);
  const [selectedPriority, setSelectedPriority] = useState<"fastest" | "cheapest" | "reliable">("reliable");
  const [detectedRegion, setDetectedRegion] = useState<string>("AE");

  const tabProgress = useSharedValue(0);

  useEffect(() => {
    if (currentLocation) {
      const region = detectRegionFromCoordinates(currentLocation.lat, currentLocation.lng);
      setDetectedRegion(region);
    }
  }, [currentLocation]);

  const { data: regionConfig } = useQuery<{ vehicleTypes?: any[] }>({
    queryKey: ["/api/regions", detectedRegion],
    enabled: !!detectedRegion,
  });

  // Fetch wallet balance for payment validation
  const { data: walletData } = useQuery<{ balance: string }>({
    queryKey: [`/api/wallet/balance/${user?.id}`],
    enabled: !!user?.id,
  });

  const walletBalance = parseFloat(walletData?.balance || "0");

  const vehicleTypes = useMemo(() => {
    const config = regionConfig as { vehicleTypes?: any[] } | undefined;
    if (config?.vehicleTypes && config.vehicleTypes.length > 0) {
      return config.vehicleTypes.map((v: any, index: number) => ({
        id: `${v.type}-${index}`,
        name: v.localName,
        type: v.type,
        baseFare: v.baseFare,
        perKmRate: v.perKmRate,
        perMinuteRate: v.perMinuteRate,
        icon: vehicleIconMap[v.type] || "car-outline",
        eta: `${3 + index * 2} min`,
      }));
    }
    return defaultVehicleTypes;
  }, [regionConfig]);

  const popularLocations = useMemo(() => {
    return POPULAR_LOCATIONS_BY_REGION[detectedRegion] || POPULAR_LOCATIONS_UAE;
  }, [detectedRegion]);

  useEffect(() => {
    if (vehicleTypes.length > 0 && !vehicleTypes.find((v: VehicleType) => v.id === selectedVehicle.id)) {
      setSelectedVehicle(vehicleTypes[0]);
    }
  }, [vehicleTypes]);

  useEffect(() => {
    onLocationChange(pickupLocation, dropoffLocation);
  }, [pickupLocation, dropoffLocation]);

  useEffect(() => {
    if (activeTab === "location") tabProgress.value = withSpring(0);
    else if (activeTab === "rides") tabProgress.value = withSpring(1);
    else tabProgress.value = withSpring(2);
  }, [activeTab]);

  const distance = useMemo(() => {
    if (!pickupLocation || !dropoffLocation) return 0;
    const R = 6371;
    const dLat = ((dropoffLocation.lat - pickupLocation.lat) * Math.PI) / 180;
    const dLng = ((dropoffLocation.lng - pickupLocation.lng) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((pickupLocation.lat * Math.PI) / 180) *
        Math.cos((dropoffLocation.lat * Math.PI) / 180) *
        Math.sin(dLng / 2) *
        Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return Math.max(R * c, 1);
  }, [pickupLocation, dropoffLocation]);

  const estimatedDuration = Math.round(distance * 3);

  const { data: aiPricing, isLoading: pricingLoading } = useQuery({
    queryKey: ["/api/ai/price", pickupLocation?.lat, pickupLocation?.lng, dropoffLocation?.lat, dropoffLocation?.lng, selectedVehicle.type, distance],
    queryFn: async () => {
      if (!pickupLocation || !dropoffLocation) return null;
      const response = await apiRequest(
        `/api/ai/price?pickupLat=${pickupLocation.lat}&pickupLng=${pickupLocation.lng}&dropoffLat=${dropoffLocation.lat}&dropoffLng=${dropoffLocation.lng}&vehicleType=${selectedVehicle.type}&distance=${distance}&duration=${estimatedDuration}`,
        { method: "GET" }
      );
      return response;
    },
    enabled: !!pickupLocation && !!dropoffLocation && activeTab !== "location",
    staleTime: 30000,
  });

  const calculateFare = (vehicle: VehicleType) => {
    if (aiPricing && vehicle.type === selectedVehicle.type) {
      const price = Number(aiPricing.finalPrice);
      return !isNaN(price) ? price.toFixed(2) : "0.00";
    }
    const fare = vehicle.baseFare + distance * vehicle.perKmRate + estimatedDuration * vehicle.perMinuteRate;
    return fare.toFixed(2);
  };

  const platformFee = aiPricing ? aiPricing.platformFee : parseFloat(calculateFare(selectedVehicle)) * 0.1;
  const driverEarnings = aiPricing ? aiPricing.driverEarnings : parseFloat(calculateFare(selectedVehicle)) * 0.9;

  const bookRideMutation = useMutation({
    mutationFn: async () => {
      if (!pickupLocation || !dropoffLocation) throw new Error("Missing locations");
      
      // Create the ride first
      const ride = await apiRequest("/api/rides", {
        method: "POST",
        body: JSON.stringify({
          customerId: user?.id,
          pickupAddress: pickupLocation.address,
          pickupLat: pickupLocation.lat.toString(),
          pickupLng: pickupLocation.lng.toString(),
          dropoffAddress: dropoffLocation.address,
          dropoffLat: dropoffLocation.lat.toString(),
          dropoffLng: dropoffLocation.lng.toString(),
          serviceTypeId: selectedVehicle.type,
          estimatedFare: calculateFare(selectedVehicle),
          distance: Number(distance.toFixed(2)),
          duration: estimatedDuration,
          paymentMethod: selectedPayment.id,
          surgeMultiplier: aiPricing?.surgeMultiplier?.toString() || "1.00",
          platformFee: platformFee.toFixed(2),
          driverEarnings: driverEarnings.toFixed(2),
          priceBreakdown: JSON.stringify(aiPricing || {}),
          priority: selectedPriority,
        }),
        headers: { "Content-Type": "application/json" },
      });

      if (selectedPayment.id === "usdt" && ride.id) {
        try {
          const invoiceResponse = await apiRequest("/api/payments/nowpayments/wallet-topup", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              amount: parseFloat(calculateFare(selectedVehicle)),
              currency: "AED",
            }),
          });
          
          if (invoiceResponse.invoiceUrl) {
            Linking.openURL(invoiceResponse.invoiceUrl);
          }
        } catch (error) {
          console.log("NOWPayments invoice creation:", error);
        }
      }

      return ride;
    },
    onSuccess: (data) => {
      console.log("Ride booked successfully:", data.id);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      queryClient.invalidateQueries({ queryKey: ["/api/rides"] });
      onBookingComplete(data.id);
    },
    onError: (error: any) => {
      console.error("Ride booking error:", error);
      const errorMessage = error.message || "Failed to book ride";
      const showError = (title: string, message: string) => {
        if (Platform.OS === "web") {
          window.alert(`${title}: ${message}`);
        } else {
          Alert.alert(title, message, [{ text: "OK" }]);
        }
      };
      if (errorMessage.includes("401") || errorMessage.toLowerCase().includes("token") || errorMessage.toLowerCase().includes("expired")) {
        showError("Session Expired", "Your session has expired. Please sign in again to book a ride.");
      } else if (errorMessage.includes("too small") || errorMessage.includes("AMOUNT_TOO_SMALL")) {
        showError("Fare Too Small for USDT", "This ride fare is below the minimum for crypto payment. Please select Cash or Wallet instead.");
      } else {
        showError("Error", errorMessage);
      }
    },
  });

  const handleBookRide = () => {
    console.log("Book ride clicked, user:", user?.id ? "logged in" : "not logged in");
    
    const showError = (title: string, message: string) => {
      if (Platform.OS === "web") {
        window.alert(`${title}: ${message}`);
      } else {
        Alert.alert(title, message, [{ text: "OK" }]);
      }
    };
    
    if (!user?.id) {
      showError("Sign In Required", "Please sign in to book a ride. Go to the Profile tab to sign in.");
      return;
    }
    
    // Calculate the fare for validation
    const fareAmount = parseFloat(calculateFare(selectedVehicle));
    
    // PAYMENT VALIDATION - Require valid payment before booking
    if (selectedPayment.id === "wallet") {
      if (walletBalance < fareAmount) {
        showError(
          "Insufficient Balance",
          `Your wallet balance (AED ${walletBalance.toFixed(2)}) is less than the fare (AED ${fareAmount.toFixed(2)}). Please top up your wallet first.`
        );
        return;
      }
    } else if (selectedPayment.id === "cash") {
      console.log("Cash payment selected - rider will pay driver directly");
    } else if (selectedPayment.id === "usdt") {
      console.log("USDT payment selected - processed via NOWPayments");
    } else {
      showError("Payment Required", "Please select a valid payment method.");
      return;
    }
    
    console.log("Booking ride with payment:", selectedPayment.id, "fare:", fareAmount);
    bookRideMutation.mutate();
  };

  const handleUseCurrentLocation = async () => {
    setIsGettingLocation(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Permission Required", "Please enable location services");
        return;
      }

      const location = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      const { latitude, longitude } = location.coords;

      const [address] = await Location.reverseGeocodeAsync({ latitude, longitude });
      const addressStr = address 
        ? [address.street, address.district, address.city].filter(Boolean).slice(0, 2).join(", ") || "Current Location"
        : "Current Location";

      setPickupLocation({ address: addressStr, lat: latitude, lng: longitude });
      setPickupSearch(addressStr);
      setActiveInput(null);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch (error) {
      console.error("Error getting location:", error);
    } finally {
      setIsGettingLocation(false);
    }
  };

  const handleSelectLocation = (location: typeof POPULAR_LOCATIONS_UAE[0]) => {
    Keyboard.dismiss();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (activeInput === "pickup") {
      setPickupLocation({ address: location.address, lat: location.lat, lng: location.lng });
      setPickupSearch(location.address);
      setActiveInput("dropoff");
    } else {
      setDropoffLocation({ address: location.address, lat: location.lat, lng: location.lng });
      setDropoffSearch(location.address);
      setActiveInput(null);
    }
  };

  const handleNextTab = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (activeTab === "location" && pickupLocation && dropoffLocation) {
      setActiveTab("rides");
    } else if (activeTab === "rides") {
      setActiveTab("confirm");
    }
  };

  const handlePrevTab = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (activeTab === "confirm") setActiveTab("rides");
    else if (activeTab === "rides") setActiveTab("location");
  };

  const filteredLocations = useMemo(() => {
    const query = (activeInput === "pickup" ? pickupSearch : dropoffSearch).toLowerCase();
    if (!query) return popularLocations;
    return popularLocations.filter((loc) => loc.address.toLowerCase().includes(query));
  }, [pickupSearch, dropoffSearch, activeInput, popularLocations]);

  const indicatorStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: interpolate(tabProgress.value, [0, 1, 2], [0, (SCREEN_WIDTH - 48) / 3, (SCREEN_WIDTH - 48) * 2 / 3]) }],
  }));

  const renderLocationTab = () => (
    <View style={styles.tabContent}>
      <View style={styles.locationInputs}>
        <Pressable
          style={[
            styles.locationInput,
            { 
              backgroundColor: activeInput === "pickup" ? theme.primary + "10" : theme.backgroundDefault,
              borderColor: activeInput === "pickup" ? theme.primary : theme.border,
            },
          ]}
          onPress={() => setActiveInput("pickup")}
        >
          <View style={[styles.locationDot, { backgroundColor: theme.primary }]} />
          <TextInput
            style={[styles.locationInputText, { color: theme.text }]}
            placeholder="Enter pickup location"
            placeholderTextColor={theme.textMuted}
            value={pickupSearch}
            onChangeText={setPickupSearch}
            onFocus={() => setActiveInput("pickup")}
          />
          {pickupSearch.length > 0 ? (
            <Pressable onPress={() => { setPickupSearch(""); setPickupLocation(null); }}>
              <Ionicons name="close-outline" size={18} color={theme.textMuted} />
            </Pressable>
          ) : null}
        </Pressable>

        <View style={styles.inputDivider}>
          <View style={[styles.verticalDash, { borderColor: theme.border }]} />
        </View>

        <Pressable
          style={[
            styles.locationInput,
            { 
              backgroundColor: activeInput === "dropoff" ? theme.error + "10" : theme.backgroundDefault,
              borderColor: activeInput === "dropoff" ? theme.error : theme.border,
            },
          ]}
          onPress={() => setActiveInput("dropoff")}
        >
          <View style={[styles.locationDot, { backgroundColor: theme.error }]} />
          <TextInput
            style={[styles.locationInputText, { color: theme.text }]}
            placeholder="Where to?"
            placeholderTextColor={theme.textMuted}
            value={dropoffSearch}
            onChangeText={setDropoffSearch}
            onFocus={() => setActiveInput("dropoff")}
          />
          {dropoffSearch.length > 0 ? (
            <Pressable onPress={() => { setDropoffSearch(""); setDropoffLocation(null); }}>
              <Ionicons name="close-outline" size={18} color={theme.textMuted} />
            </Pressable>
          ) : null}
        </Pressable>
      </View>

      {activeInput === "pickup" ? (
        <Pressable
          style={[styles.currentLocationBtn, { backgroundColor: theme.primary + "15" }]}
          onPress={handleUseCurrentLocation}
          disabled={isGettingLocation}
        >
          {isGettingLocation ? (
            <ActivityIndicator size="small" color={theme.primary} />
          ) : (
            <Ionicons name="locate-outline" size={18} color={theme.primary} />
          )}
          <ThemedText style={[styles.currentLocationText, { color: theme.primary }]}>
            {isGettingLocation ? "Getting location..." : "Use current location"}
          </ThemedText>
        </Pressable>
      ) : null}

      <FlatList
        data={filteredLocations}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <Pressable
            style={({ pressed }) => [
              styles.locationItem,
              { backgroundColor: pressed ? theme.backgroundPressed : "transparent" },
            ]}
            onPress={() => handleSelectLocation(item)}
          >
            <View style={[styles.locationItemIcon, { backgroundColor: theme.primary + "15" }]}>
              <Ionicons name={item.icon as any} size={16} color={theme.primary} />
            </View>
            <ThemedText style={styles.locationItemText} numberOfLines={1}>
              {item.address}
            </ThemedText>
          </Pressable>
        )}
        style={styles.locationsList}
        keyboardShouldPersistTaps="handled"
      />

      <Pressable
        style={[
          styles.nextButton,
          { 
            backgroundColor: theme.primary,
            opacity: pickupLocation && dropoffLocation ? 1 : 0.5,
          },
        ]}
        onPress={handleNextTab}
        disabled={!pickupLocation || !dropoffLocation}
      >
        <ThemedText style={styles.nextButtonText}>Choose Ride</ThemedText>
        <Ionicons name="arrow-forward-outline" size={20} color="#FFFFFF" />
      </Pressable>
    </View>
  );

  const renderRidesTab = () => (
    <View style={styles.tabContent}>
      <View style={styles.tripSummary}>
        <View style={styles.tripRow}>
          <Ionicons name="location-outline" size={14} color={theme.primary} />
          <ThemedText style={[styles.tripText, { color: theme.textSecondary }]} numberOfLines={1}>
            {pickupLocation?.address}
          </ThemedText>
        </View>
        <Ionicons name="arrow-forward-outline" size={14} color={theme.textMuted} />
        <View style={styles.tripRow}>
          <Ionicons name="flag-outline" size={14} color={theme.error} />
          <ThemedText style={[styles.tripText, { color: theme.textSecondary }]} numberOfLines={1}>
            {dropoffLocation?.address}
          </ThemedText>
        </View>
      </View>

      <View style={styles.tripStats}>
        <View style={styles.tripStat}>
          <Ionicons name="compass-outline" size={14} color={theme.textMuted} />
          <ThemedText style={[styles.tripStatText, { color: theme.textSecondary }]}>
            {distance.toFixed(1)} km
          </ThemedText>
        </View>
        <View style={[styles.tripStatDivider, { backgroundColor: theme.border }]} />
        <View style={styles.tripStat}>
          <Ionicons name="time-outline" size={14} color={theme.textMuted} />
          <ThemedText style={[styles.tripStatText, { color: theme.textSecondary }]}>
            ~{estimatedDuration} min
          </ThemedText>
        </View>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.vehicleScroll}>
        {vehicleTypes.map((vehicle: VehicleType) => (
          <Pressable
            key={vehicle.id}
            style={[
              styles.vehicleCard,
              {
                backgroundColor: selectedVehicle.id === vehicle.id ? theme.primary + "10" : theme.card,
                borderColor: selectedVehicle.id === vehicle.id ? theme.primary : theme.border,
              },
            ]}
            onPress={() => {
              setSelectedVehicle(vehicle);
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            }}
          >
            <View style={[styles.vehicleIconWrap, { backgroundColor: theme.backgroundDefault }]}>
              <Ionicons name={vehicle.icon as any} size={24} color={theme.primary} />
            </View>
            <ThemedText style={styles.vehicleName}>{vehicle.name}</ThemedText>
            <ThemedText style={[styles.vehicleEta, { color: theme.textMuted }]}>{vehicle.eta}</ThemedText>
            <ThemedText style={[styles.vehiclePrice, { color: theme.primary }]}>
              AED {calculateFare(vehicle)}
            </ThemedText>
          </Pressable>
        ))}
      </ScrollView>

      {aiPricing?.surgeMultiplier > 1 ? (
        <View style={[styles.surgeBanner, { backgroundColor: theme.warning + "20" }]}>
          <Ionicons name="trending-up-outline" size={14} color={theme.warning} />
          <ThemedText style={[styles.surgeText, { color: theme.warning }]}>
            {aiPricing.surgeMultiplier.toFixed(1)}x demand pricing (max 1.5x)
          </ThemedText>
        </View>
      ) : null}

      {pickupLocation && dropoffLocation ? (
        <FasterPickupBanner
          pickupLat={pickupLocation.lat}
          pickupLng={pickupLocation.lng}
          dropoffLat={dropoffLocation.lat}
          dropoffLng={dropoffLocation.lng}
          baseFare={parseFloat(calculateFare(selectedVehicle))}
          selectedDriver={selectedPmgthDriver}
          onSelectFasterPickup={setSelectedPmgthDriver}
        />
      ) : null}

      <View style={styles.tabButtons}>
        <Pressable style={[styles.backButton, { borderColor: theme.border }]} onPress={handlePrevTab}>
          <Ionicons name="arrow-back-outline" size={20} color={theme.text} />
        </Pressable>
        <Pressable style={[styles.continueButton, { backgroundColor: theme.primary }]} onPress={handleNextTab}>
          <ThemedText style={styles.continueButtonText}>Continue</ThemedText>
          <Ionicons name="arrow-forward-outline" size={20} color="#FFFFFF" />
        </Pressable>
      </View>
    </View>
  );

  const renderConfirmTab = () => (
    <View style={styles.tabContent}>
      <View style={[styles.fareCard, { backgroundColor: theme.card }]}>
        <View style={styles.fareHeader}>
          <View style={[styles.vehicleBadge, { backgroundColor: theme.primary + "15" }]}>
            <Ionicons name={selectedVehicle.icon as any} size={20} color={theme.primary} />
            <ThemedText style={[styles.vehicleBadgeText, { color: theme.primary }]}>
              {selectedVehicle.name}
            </ThemedText>
          </View>
          <ThemedText style={[styles.fareTotal, { color: theme.primary }]}>
            AED {(Number(calculateFare(selectedVehicle)) + (selectedPmgthDriver?.premiumAmount || 0)).toFixed(2)}
          </ThemedText>
        </View>

        {selectedPmgthDriver ? (
          <View style={[styles.fasterPickupBadge, { backgroundColor: Colors.travonyGreen + "15" }]}>
            <Ionicons name="flash" size={14} color={Colors.travonyGreen} />
            <ThemedText style={[styles.fasterPickupText, { color: Colors.travonyGreen }]}>
              Faster Pickup - {selectedPmgthDriver.estimatedPickupMinutes} min
            </ThemedText>
          </View>
        ) : null}

        <View style={[styles.fareDivider, { backgroundColor: theme.border }]} />

        <View style={styles.fareBreakdown}>
          <View style={styles.fareRow}>
            <ThemedText style={[styles.fareLabel, { color: theme.textSecondary }]}>Base fare</ThemedText>
            <ThemedText style={styles.fareValue}>AED {aiPricing?.baseFare?.toFixed(2) || selectedVehicle.baseFare.toFixed(2)}</ThemedText>
          </View>
          <View style={styles.fareRow}>
            <ThemedText style={[styles.fareLabel, { color: theme.textSecondary }]}>Distance ({distance.toFixed(1)} km)</ThemedText>
            <ThemedText style={styles.fareValue}>AED {aiPricing?.distanceCharge?.toFixed(2) || (distance * selectedVehicle.perKmRate).toFixed(2)}</ThemedText>
          </View>
          <View style={styles.fareRow}>
            <ThemedText style={[styles.fareLabel, { color: theme.textSecondary }]}>Time (~{estimatedDuration} min)</ThemedText>
            <ThemedText style={styles.fareValue}>AED {aiPricing?.timeCharge?.toFixed(2) || (estimatedDuration * selectedVehicle.perMinuteRate).toFixed(2)}</ThemedText>
          </View>
          {selectedPmgthDriver ? (
            <View style={styles.fareRow}>
              <ThemedText style={[styles.fareLabel, { color: Colors.travonyGreen }]}>Faster Pickup</ThemedText>
              <ThemedText style={[styles.fareValue, { color: Colors.travonyGreen }]}>AED {selectedPmgthDriver.premiumAmount.toFixed(2)}</ThemedText>
            </View>
          ) : null}
        </View>

        <View style={[styles.transparencyRow, { backgroundColor: theme.primary + "08" }]}>
          <View style={styles.transparencyItem}>
            <Ionicons name="shield-checkmark-outline" size={14} color={theme.primary} />
            <ThemedText style={[styles.transparencyLabel, { color: theme.textMuted }]}>Platform (10%)</ThemedText>
            <ThemedText style={styles.transparencyValue}>AED {Number(platformFee).toFixed(2)}</ThemedText>
          </View>
          <View style={styles.transparencyItem}>
            <Ionicons name="person-outline" size={14} color={theme.success} />
            <ThemedText style={[styles.transparencyLabel, { color: theme.textMuted }]}>Driver (90%)</ThemedText>
            <ThemedText style={[styles.transparencyValue, { color: theme.success }]}>AED {Number(driverEarnings).toFixed(2)}</ThemedText>
          </View>
        </View>
      </View>

      <ThemedText style={styles.sectionLabel}>What matters most?</ThemedText>
      <View style={styles.priorityRow}>
        {([
          { id: "fastest", label: "Fastest", icon: "flash-outline", desc: "Priority pickup" },
          { id: "cheapest", label: "Cheapest", icon: "wallet-outline", desc: "Best value" },
          { id: "reliable", label: "Most Reliable", icon: "shield-checkmark-outline", desc: "Trusted drivers" },
        ] as const).map((priority) => (
          <Pressable
            key={priority.id}
            style={[
              styles.priorityOption,
              {
                backgroundColor: selectedPriority === priority.id ? theme.primary + "15" : theme.card,
                borderColor: selectedPriority === priority.id ? theme.primary : theme.border,
              },
            ]}
            onPress={() => {
              setSelectedPriority(priority.id);
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            }}
          >
            <Ionicons 
              name={priority.icon} 
              size={20} 
              color={selectedPriority === priority.id ? theme.primary : theme.textSecondary} 
            />
            <ThemedText 
              style={[
                styles.priorityLabel, 
                { color: selectedPriority === priority.id ? theme.primary : theme.text }
              ]}
            >
              {priority.label}
            </ThemedText>
            <ThemedText style={[styles.priorityDesc, { color: theme.textMuted }]}>
              {priority.desc}
            </ThemedText>
          </Pressable>
        ))}
      </View>

      <ThemedText style={styles.sectionLabel}>Payment</ThemedText>
      <View style={styles.paymentRow}>
        {paymentMethods.map((method) => (
          <Pressable
            key={method.id}
            style={[
              styles.paymentOption,
              {
                backgroundColor: selectedPayment.id === method.id ? theme.primary + "10" : theme.card,
                borderColor: selectedPayment.id === method.id ? theme.primary : theme.border,
              },
            ]}
            onPress={() => {
              setSelectedPayment(method);
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            }}
          >
            <Ionicons name={method.icon as any} size={18} color={selectedPayment.id === method.id ? theme.primary : theme.text} />
            <ThemedText style={[styles.paymentText, { color: selectedPayment.id === method.id ? theme.primary : theme.text }]}>
              {method.name}
            </ThemedText>
          </Pressable>
        ))}
      </View>

      <View style={styles.tabButtons}>
        <Pressable style={[styles.backButton, { borderColor: theme.border }]} onPress={handlePrevTab}>
          <Ionicons name="arrow-back-outline" size={20} color={theme.text} />
        </Pressable>
        <Pressable
          style={[
            styles.bookButton,
            { 
              backgroundColor: !user?.id ? theme.warning : theme.primary, 
              opacity: bookRideMutation.isPending ? 0.7 : 1 
            },
          ]}
          onPress={handleBookRide}
          disabled={bookRideMutation.isPending}
        >
          {bookRideMutation.isPending ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : !user?.id ? (
            <ThemedText style={styles.bookButtonText}>Sign in to Book</ThemedText>
          ) : (
            <>
              <ThemedText style={styles.bookButtonText}>Book {selectedVehicle.name}</ThemedText>
              <ThemedText style={styles.bookButtonPrice}>AED {calculateFare(selectedVehicle)}</ThemedText>
            </>
          )}
        </Pressable>
      </View>
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.card, paddingBottom: bottomInset + Spacing.md }]}>
      <View style={[styles.handle, { backgroundColor: theme.border }]} />
      
      <View style={styles.tabBar}>
        {[
          { key: "location", label: "Where?", icon: "location-outline" },
          { key: "rides", label: "Rides", icon: "car-outline" },
          { key: "confirm", label: "Confirm", icon: "checkmark-circle-outline" },
        ].map((tab, index) => (
          <Pressable
            key={tab.key}
            style={styles.tabItem}
            onPress={() => {
              if (tab.key === "location") setActiveTab("location");
              else if (tab.key === "rides" && pickupLocation && dropoffLocation) setActiveTab("rides");
              else if (tab.key === "confirm" && pickupLocation && dropoffLocation) setActiveTab("confirm");
            }}
          >
            <Ionicons
              name={tab.icon as any}
              size={18}
              color={activeTab === tab.key ? theme.primary : theme.textMuted}
            />
            <ThemedText
              style={[
                styles.tabLabel,
                { color: activeTab === tab.key ? theme.primary : theme.textMuted },
              ]}
            >
              {tab.label}
            </ThemedText>
          </Pressable>
        ))}
        <Animated.View
          style={[
            styles.tabIndicator,
            { backgroundColor: theme.primary },
            indicatorStyle,
          ]}
        />
      </View>

      {activeTab === "location" && renderLocationTab()}
      {activeTab === "rides" && renderRidesTab()}
      {activeTab === "confirm" && renderConfirmTab()}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    paddingHorizontal: Spacing.lg,
    ...Shadows.card,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    alignSelf: "center",
    marginTop: Spacing.sm,
    marginBottom: Spacing.md,
  },
  tabBar: {
    flexDirection: "row",
    marginBottom: Spacing.md,
    position: "relative",
  },
  tabItem: {
    flex: 1,
    alignItems: "center",
    paddingVertical: Spacing.sm,
    flexDirection: "row",
    justifyContent: "center",
    gap: Spacing.xs,
  },
  tabLabel: {
    ...Typography.caption,
    fontWeight: "600",
  },
  tabIndicator: {
    position: "absolute",
    bottom: 0,
    left: 0,
    width: (SCREEN_WIDTH - 48) / 3,
    height: 2,
    borderRadius: 1,
  },
  tabContent: {
    minHeight: 280,
  },
  locationInputs: {
    marginBottom: Spacing.md,
  },
  locationInput: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.md,
    height: 48,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
  },
  locationDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: Spacing.md,
  },
  locationInputText: {
    flex: 1,
    ...Typography.body,
  },
  inputDivider: {
    height: 16,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 19,
  },
  verticalDash: {
    height: 16,
    borderLeftWidth: 1,
    borderStyle: "dashed",
  },
  currentLocationBtn: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    borderRadius: BorderRadius.sm,
    marginBottom: Spacing.md,
    gap: Spacing.sm,
  },
  currentLocationText: {
    ...Typography.body,
    fontWeight: "500",
  },
  locationsList: {
    maxHeight: 160,
  },
  locationItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: Spacing.sm,
    gap: Spacing.md,
  },
  locationItemIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  locationItemText: {
    ...Typography.body,
    flex: 1,
  },
  nextButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    height: 52,
    borderRadius: BorderRadius.sm,
    marginTop: Spacing.md,
    gap: Spacing.sm,
  },
  nextButtonText: {
    ...Typography.button,
    color: "#FFFFFF",
  },
  tripSummary: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  tripRow: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    gap: Spacing.xs,
  },
  tripText: {
    ...Typography.caption,
    flex: 1,
  },
  tripStats: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.md,
    gap: Spacing.md,
  },
  tripStat: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
  },
  tripStatText: {
    ...Typography.caption,
  },
  tripStatDivider: {
    width: 1,
    height: 16,
  },
  vehicleScroll: {
    marginHorizontal: -Spacing.lg,
    paddingHorizontal: Spacing.lg,
  },
  vehicleCard: {
    width: 110,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1.5,
    marginRight: Spacing.sm,
    alignItems: "center",
  },
  vehicleIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.xs,
  },
  vehicleName: {
    ...Typography.body,
    fontWeight: "600",
    marginBottom: 2,
  },
  vehicleEta: {
    ...Typography.caption,
    marginBottom: Spacing.xs,
  },
  vehiclePrice: {
    ...Typography.body,
    fontWeight: "700",
  },
  surgeBanner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: Spacing.sm,
    borderRadius: BorderRadius.sm,
    marginTop: Spacing.md,
    gap: Spacing.xs,
  },
  surgeText: {
    ...Typography.caption,
    fontWeight: "500",
  },
  tabButtons: {
    flexDirection: "row",
    gap: Spacing.md,
    marginTop: Spacing.lg,
  },
  backButton: {
    width: 52,
    height: 52,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  continueButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    height: 52,
    borderRadius: BorderRadius.sm,
    gap: Spacing.sm,
  },
  continueButtonText: {
    ...Typography.button,
    color: "#FFFFFF",
  },
  fareCard: {
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginBottom: Spacing.md,
  },
  fareHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  vehicleBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.sm,
    borderRadius: BorderRadius.sm,
    gap: Spacing.xs,
  },
  vehicleBadgeText: {
    ...Typography.body,
    fontWeight: "600",
  },
  fasterPickupBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.sm,
    borderRadius: BorderRadius.sm,
    gap: Spacing.xs,
    marginTop: Spacing.sm,
  },
  fasterPickupText: {
    ...Typography.small,
    fontWeight: "600",
  },
  fareTotal: {
    ...Typography.h3,
    fontWeight: "700",
  },
  fareDivider: {
    height: 1,
    marginVertical: Spacing.md,
  },
  fareBreakdown: {
    gap: Spacing.xs,
  },
  fareRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  fareLabel: {
    ...Typography.caption,
  },
  fareValue: {
    ...Typography.caption,
    fontWeight: "500",
  },
  transparencyRow: {
    flexDirection: "row",
    marginTop: Spacing.md,
    padding: Spacing.sm,
    borderRadius: BorderRadius.sm,
    gap: Spacing.md,
  },
  transparencyItem: {
    flex: 1,
    alignItems: "center",
    gap: 2,
  },
  transparencyLabel: {
    ...Typography.caption,
    fontSize: 10,
  },
  transparencyValue: {
    ...Typography.caption,
    fontWeight: "600",
  },
  sectionLabel: {
    ...Typography.caption,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: Spacing.sm,
  },
  priorityRow: {
    flexDirection: "row",
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  priorityOption: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.sm,
    borderRadius: BorderRadius.md,
    borderWidth: 1.5,
    gap: Spacing.xs,
  },
  priorityLabel: {
    ...Typography.caption,
    fontWeight: "600",
    textAlign: "center",
  },
  priorityDesc: {
    ...Typography.small,
    fontSize: 10,
    textAlign: "center",
  },
  paymentRow: {
    flexDirection: "row",
    gap: Spacing.sm,
  },
  paymentOption: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.sm,
    borderWidth: 1.5,
    gap: Spacing.xs,
  },
  paymentText: {
    ...Typography.caption,
    fontWeight: "600",
  },
  bookButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    height: 52,
    borderRadius: BorderRadius.sm,
    gap: Spacing.md,
  },
  bookButtonText: {
    ...Typography.button,
    color: "#FFFFFF",
  },
  bookButtonPrice: {
    ...Typography.button,
    color: "#FFFFFF",
    opacity: 0.9,
  },
});
