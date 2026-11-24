from typing import Dict, List, TypedDict


class DistrictCoord(TypedDict):
    name: str
    lat: float
    lon: float
    base_elev: float
    base_slope: float
    base_rain: float


class StateInfo(TypedDict):
    state: str
    code: str
    capital: str
    center_lat: float
    center_lon: float
    polygon: List[List[float]]  # [lon, lat] GeoJSON ring
    districts: List[DistrictCoord]


NER_REFERENCE: List[StateInfo] = [
    {
        "state": "Sikkim",
        "code": "SK",
        "capital": "Gangtok",
        "center_lat": 27.5330,
        "center_lon": 88.5122,
        "polygon": [
            [88.05, 27.10],
            [88.88, 27.12],
            [88.92, 27.85],
            [88.62, 28.12],
            [88.12, 27.95],
            [88.02, 27.45],
            [88.05, 27.10],
        ],
        "districts": [
            {"name": "Gangtok", "lat": 27.3314, "lon": 88.6138, "base_elev": 1650, "base_slope": 31.0, "base_rain": 3250},
            {"name": "Mangan", "lat": 27.5097, "lon": 88.5222, "base_elev": 2380, "base_slope": 38.5, "base_rain": 3420},
            {"name": "Namchi", "lat": 27.1670, "lon": 88.3652, "base_elev": 1315, "base_slope": 26.0, "base_rain": 2650},
            {"name": "Gyalshing", "lat": 27.2896, "lon": 88.2528, "base_elev": 1820, "base_slope": 33.5, "base_rain": 2980},
        ],
    },
    {
        "state": "Arunachal Pradesh",
        "code": "AR",
        "capital": "Itanagar",
        "center_lat": 28.2180,
        "center_lon": 94.7278,
        "polygon": [
            [91.55, 26.92],
            [92.75, 26.96],
            [94.35, 27.48],
            [95.85, 27.82],
            [96.65, 27.32],
            [97.38, 27.72],
            [97.25, 28.45],
            [96.15, 29.22],
            [94.80, 29.35],
            [93.35, 28.65],
            [92.15, 27.95],
            [91.55, 27.45],
            [91.55, 26.92],
        ],
        "districts": [
            {"name": "Tawang", "lat": 27.5860, "lon": 91.8594, "base_elev": 2890, "base_slope": 37.0, "base_rain": 2150},
            {"name": "Papum Pare", "lat": 27.1023, "lon": 93.6945, "base_elev": 680, "base_slope": 24.5, "base_rain": 3180},
            {"name": "West Kameng", "lat": 27.2667, "lon": 92.4167, "base_elev": 2120, "base_slope": 34.0, "base_rain": 2380},
            {"name": "Lower Subansiri", "lat": 27.5500, "lon": 93.8300, "base_elev": 1570, "base_slope": 28.5, "base_rain": 2720},
        ],
    },
    {
        "state": "Assam",
        "code": "AS",
        "capital": "Dispur",
        "center_lat": 26.2006,
        "center_lon": 92.9376,
        "polygon": [
            [89.70, 25.95],
            [90.55, 26.75],
            [92.55, 26.92],
            [94.35, 27.48],
            [95.85, 27.82],
            [95.75, 27.20],
            [94.70, 26.65],
            [93.55, 26.15],
            [93.45, 25.10],
            [92.52, 24.48],
            [92.15, 25.12],
            [92.65, 25.82],
            [91.55, 26.05],
            [90.15, 25.95],
            [89.70, 25.95],
        ],
        "districts": [
            {"name": "Dima Hasao", "lat": 25.1700, "lon": 93.0200, "base_elev": 940, "base_slope": 29.0, "base_rain": 2680},
            {"name": "Kamrup Metropolitan", "lat": 26.1445, "lon": 91.7362, "base_elev": 115, "base_slope": 11.5, "base_rain": 1820},
            {"name": "Karbi Anglong", "lat": 26.0200, "lon": 93.4500, "base_elev": 420, "base_slope": 19.0, "base_rain": 1950},
            {"name": "Cachar", "lat": 24.8333, "lon": 92.7789, "base_elev": 65, "base_slope": 9.5, "base_rain": 2890},
        ],
    },
    {
        "state": "Meghalaya",
        "code": "ML",
        "capital": "Shillong",
        "center_lat": 25.4670,
        "center_lon": 91.3662,
        "polygon": [
            [89.88, 25.35],
            [90.15, 25.95],
            [91.55, 26.05],
            [92.65, 25.82],
            [92.48, 25.15],
            [91.35, 25.18],
            [90.35, 25.12],
            [89.88, 25.35],
        ],
        "districts": [
            {"name": "East Khasi Hills", "lat": 25.5788, "lon": 91.8933, "base_elev": 1495, "base_slope": 27.5, "base_rain": 4450},
            {"name": "West Garo Hills", "lat": 25.5122, "lon": 90.2202, "base_elev": 410, "base_slope": 18.5, "base_rain": 2950},
            {"name": "Ri Bhoi", "lat": 25.9012, "lon": 91.8810, "base_elev": 690, "base_slope": 21.0, "base_rain": 2480},
            {"name": "West Jaintia Hills", "lat": 25.4480, "lon": 92.2030, "base_elev": 1340, "base_slope": 24.5, "base_rain": 3890},
        ],
    },
    {
        "state": "Nagaland",
        "code": "NL",
        "capital": "Kohima",
        "center_lat": 26.1584,
        "center_lon": 94.5624,
        "polygon": [
            [93.45, 25.55],
            [93.85, 26.15],
            [94.70, 26.65],
            [95.32, 26.92],
            [95.22, 26.15],
            [94.88, 25.55],
            [94.15, 25.38],
            [93.45, 25.55],
        ],
        "districts": [
            {"name": "Kohima", "lat": 25.6751, "lon": 94.1086, "base_elev": 1444, "base_slope": 29.5, "base_rain": 2250},
            {"name": "Mokokchung", "lat": 26.3220, "lon": 94.5236, "base_elev": 1325, "base_slope": 27.0, "base_rain": 2450},
            {"name": "Wokha", "lat": 26.0970, "lon": 94.2580, "base_elev": 1180, "base_slope": 25.5, "base_rain": 2310},
            {"name": "Dimapur", "lat": 25.9091, "lon": 93.7266, "base_elev": 220, "base_slope": 10.0, "base_rain": 1680},
        ],
    },
    {
        "state": "Manipur",
        "code": "MN",
        "capital": "Imphal",
        "center_lat": 24.6637,
        "center_lon": 93.9063,
        "polygon": [
            [93.02, 24.25],
            [93.35, 25.25],
            [94.15, 25.38],
            [94.68, 25.15],
            [94.52, 24.15],
            [93.85, 23.85],
            [93.12, 23.95],
            [93.02, 24.25],
        ],
        "districts": [
            {"name": "Tamenglong", "lat": 24.9896, "lon": 93.5015, "base_elev": 1290, "base_slope": 32.0, "base_rain": 3120},
            {"name": "Senapati", "lat": 25.2683, "lon": 94.0227, "base_elev": 1360, "base_slope": 28.0, "base_rain": 2180},
            {"name": "Ukhrul", "lat": 25.0968, "lon": 94.3617, "base_elev": 1660, "base_slope": 30.5, "base_rain": 2050},
            {"name": "Imphal West", "lat": 24.8170, "lon": 93.9368, "base_elev": 785, "base_slope": 7.5, "base_rain": 1460},
        ],
    },
    {
        "state": "Mizoram",
        "code": "MZ",
        "capital": "Aizawl",
        "center_lat": 23.1645,
        "center_lon": 92.9376,
        "polygon": [
            [92.25, 22.05],
            [92.32, 23.45],
            [92.62, 24.42],
            [93.25, 24.22],
            [93.42, 23.05],
            [93.15, 22.02],
            [92.65, 21.95],
            [92.25, 22.05],
        ],
        "districts": [
            {"name": "Aizawl", "lat": 23.7271, "lon": 92.7176, "base_elev": 1132, "base_slope": 31.5, "base_rain": 2540},
            {"name": "Lunglei", "lat": 22.8891, "lon": 92.7478, "base_elev": 1180, "base_slope": 32.5, "base_rain": 2760},
            {"name": "Serchhip", "lat": 23.3095, "lon": 92.8489, "base_elev": 1020, "base_slope": 29.0, "base_rain": 2410},
            {"name": "Kolasib", "lat": 24.2242, "lon": 92.6780, "base_elev": 680, "base_slope": 23.0, "base_rain": 2690},
        ],
    },
    {
        "state": "Tripura",
        "code": "TR",
        "capital": "Agartala",
        "center_lat": 23.9408,
        "center_lon": 91.9882,
        "polygon": [
            [91.15, 23.25],
            [91.22, 24.15],
            [92.15, 24.52],
            [92.32, 23.85],
            [91.95, 23.02],
            [91.35, 22.95],
            [91.15, 23.25],
        ],
        "districts": [
            {"name": "Dhalai", "lat": 23.8467, "lon": 91.9099, "base_elev": 260, "base_slope": 18.0, "base_rain": 2420},
            {"name": "North Tripura", "lat": 24.3167, "lon": 92.1667, "base_elev": 195, "base_slope": 16.5, "base_rain": 2580},
            {"name": "West Tripura", "lat": 23.8315, "lon": 91.2868, "base_elev": 45, "base_slope": 6.5, "base_rain": 2120},
            {"name": "Gomati", "lat": 23.5340, "lon": 91.4880, "base_elev": 120, "base_slope": 12.0, "base_rain": 2240},
        ],
    },
]

STATE_BY_NAME: Dict[str, StateInfo] = {s["state"]: s for s in NER_REFERENCE}
