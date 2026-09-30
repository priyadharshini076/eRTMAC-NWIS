/**
 * NWIS - Nearby Well Intelligence System
 * Comprehensive Master Wells Dataset & ML Hazard Model Profiles
 * Oil India Limited | Ministry of Petroleum & Natural Gas
 */

const WELLS_DATA = [
  {
    wellId: "OIL-AS-NHRK-104",
    apiNumber: "OIL-ASM-000104",
    wellName: "Nahorkatiya-104 (Active Target)",
    field: "Nahorkatiya",
    fieldCode: "NHK 104",
    basin: "Assam-Arakan",
    district: "Dibrugarh",
    state: "Assam",
    blockName: "PEL-ASSAM-02",
    operator: "Oil India Limited",
    targetDepthM: 3842,
    currentDepthM: 3842,
    measuredDepthM: 4100,
    trueVerticalDepthM: 3842,
    formation: "Barail Sandstone",
    formationAge: "Upper Eocene to Oligocene",
    formationTopM: 2850,
    formationBottomM: 3950,
    lithology: "Interbedded Carbonaceous Shale, Siltstone and Fine Sandstone",
    porePressurePsi: 4120,
    porePressurePpg: 14.8,
    fractureGradientPpg: 15.4,
    mudType: "Glycol-PHPA WBM",
    currentMudWeightSg: 1.32,
    currentMudWeightPpg: 11.02,
    rigName: "BHEL 2000 HP (Rig #14)",
    spudDate: "12-Mar-2021",
    status: "Active Drilling",
    riskZone: "High Risk",
    coordinates: { lat: 27.2945, lng: 95.3412 },
    offsetWellsCount: 14,
    closestOffset: {
      name: "NHRK-98",
      distanceKm: 2.4,
      direction: "North-East",
      nptIncident: "Stuck Pipe at 2,450m (62 hrs NPT), Mud Loss (45 bbls)",
      completionDate: "28-Aug-2018"
    },
    // ML Simulation Profile
    simulation: {
      fusedScore: 78.4,
      riskLevel: "CRITICAL / HIGH HAZARD",
      riskClass: "HIGH_RISK",
      confidence: 94.2,
      hazardProbabilities: [
        { name: "Stuck Pipe (Differential / Mechanical)", probability: 82, trend: "+14% in last 50m", status: "Critical", color: "#dc2626" },
        { name: "Lost Circulation / Mud Loss", probability: 68, trend: "+8% in last 30m", status: "High", color: "#ea580c" },
        { name: "Wellbore Instability / Sloughing Shale", probability: 74, trend: "Erratic cavings detected", status: "High", color: "#ea580c" },
        { name: "Kick / Well Control Risk", probability: 46, trend: "Stable flowline monitor", status: "Moderate", color: "#d97706" },
        { name: "Pore Pressure Squeeze / Tight Hole", probability: 63, trend: "Overburden stress rising", status: "High", color: "#ea580c" }
      ],
      telemetryAnomalies: [
        { parameter: "Standpipe Pressure (SPP)", current: "3,420 psi", normal: "3,080 psi", delta: "+340 psi", alert: true },
        { parameter: "Rotary Torque", current: "28.4 kft-lb", normal: "21.0 kft-lb", delta: "+35% Erratic", alert: true },
        { parameter: "Flow Delta (Out - In)", current: "-42 gpm", normal: "0 gpm", delta: "Partial Losses", alert: true },
        { parameter: "Rate of Penetration (ROP)", current: "4.2 m/hr", normal: "14.8 m/hr", delta: "-71% Deceleration", alert: true },
        { parameter: "Equivalent Circulating Density (ECD)", current: "1.41 SG", normal: "1.36 SG", delta: "Near Frac Margin", alert: true }
      ],
      explanations: {
        geologicalDrivers: [
          "Transition into Barail Coal-Shale horizon (3,800m - 3,842m TVD) exhibiting severe tectonic compaction anisotropy and micro-fractures.",
          "Formation pore pressure has surged to 14.8 ppg equivalent, creating a narrow drilling window against fracture gradient (15.4 ppg). Current mud weight of 1.32 SG (11.02 ppg) creates a critical 3.78 ppg underbalance condition during static stops."
        ],
        offsetPrecedents: [
          "Offset well NHRK-98 (2.4 km NE) encountered identical lithological sequence at 2,450m - 2,800m, resulting in 62 hours of Non-Productive Time (NPT) due to drillstring pack-off and differential sticking.",
          "Nearby well OIL-BGJ-001 (Baghjan) recorded severe mud losses into fractured sandstones immediately upon penetrating the upper Barail coal marker."
        ],
        featureImportance: [
          { feature: "Differential Pressure (Mud vs Formation)", weight: 34 },
          { feature: "Torque Variance & Micro-stalling", weight: 26 },
          { feature: "Offset Historical NPT Precedent", weight: 18 },
          { feature: "ROP Deceleration Gradient", weight: 14 },
          { feature: "Shale Cavings Volume Index", weight: 8 }
        ]
      },
      recommendedActions: [
        {
          priority: "IMMEDIATE",
          action: "Weigh Up Drilling Fluid to 1.37 - 1.38 SG",
          detail: "Add micronized Barite systematically into active suction pit. Bring active mud weight from 1.32 SG (11.0 ppg) to 1.38 SG (11.5 ppg) to stabilize sloughing Barail carbonaceous shale without exceeding formation fracture gradient.",
          category: "Mud Chemistry"
        },
        {
          priority: "IMMEDIATE",
          action: "Controlled Drill String Reaming & Wiper Trip",
          detail: "Halt rotary drilling ahead immediately. Pump high-viscosity pill (40 bbls, 65 sec funnel vis) followed by low-vis weighted pill. Perform controlled wiper trip back to casing shoe at 2,850m with continuous hole fill monitoring.",
          category: "Rig Operations"
        },
        {
          priority: "OPERATIONAL",
          action: "Optimize Hydraulics & Reduce Rotary RPM",
          detail: "Limit rotary table speed to 60-70 RPM to prevent drillstring whip in over-gauge hole. Adjust mud pump discharge to maintain annular velocity at 68 m/min to prevent cuttings bed accumulation around the BHA.",
          category: "Drilling Hydraulics"
        },
        {
          priority: "CONTINGENCY",
          action: "Stage 50 bbls Coarse LCM Pill in Reserve Tank #2",
          detail: "Premix calcium carbonate and mica LCM pill (35 ppb) ready for immediate bullheading if micro-fracture induced losses escalate beyond 25 bbls/hr during mud weigh-up.",
          category: "Well Control"
        }
      ],
      parameterMatrix: [
        { parameter: "Mud Weight (SG)", current: "1.32", recommended: "1.38", safeRange: "1.36 - 1.40" },
        { parameter: "Rotary Speed (RPM)", current: "110", recommended: "65", safeRange: "55 - 75" },
        { parameter: "Weight on Bit (WOB - klbs)", current: "26", recommended: "16", safeRange: "14 - 18" },
        { parameter: "Pump Flow Rate (LPM)", current: "2,150", recommended: "2,420", safeRange: "2,300 - 2,500" },
        { parameter: "Plastic Viscosity (cP)", current: "19", recommended: "26", safeRange: "24 - 28" }
      ],
      sopReference: "OIL/DD/NWIS/ASSAM-2024/SOP-BARAIL-44"
    }
  },
  {
    wellId: "OIL-DGB-001",
    apiNumber: "OIL-ASM-000001",
    wellName: "Digboi-001 (Historic Field)",
    field: "Digboi",
    fieldCode: "DGB 01",
    basin: "Assam-Arakan",
    district: "Tinsukia",
    state: "Assam",
    blockName: "PEL-ASSAM-01",
    operator: "Oil India Limited",
    targetDepthM: 2459,
    currentDepthM: 2445,
    measuredDepthM: 2475,
    trueVerticalDepthM: 2445,
    formation: "Tipam Sandstone",
    formationAge: "Miocene",
    formationTopM: 1487,
    formationBottomM: 2091,
    lithology: "Fine to Medium Sandstone with Shale Interbeds",
    porePressurePsi: 2755.9,
    porePressurePpg: 14.1,
    fractureGradientPpg: 16.2,
    mudType: "KCl Polymer WBM",
    currentMudWeightSg: 1.22,
    currentMudWeightPpg: 10.18,
    rigName: "OIL Rig-05",
    spudDate: "04-Apr-2018",
    status: "Completed / Monitoring",
    riskZone: "Low Risk",
    coordinates: { lat: 27.4108, lng: 95.6453 },
    offsetWellsCount: 18,
    closestOffset: {
      name: "DGB-002",
      distanceKm: 4.1,
      direction: "South",
      nptIncident: "Minor seepage loss at 1,820m",
      completionDate: "21-Jan-2015"
    },
    simulation: {
      fusedScore: 36.2,
      riskLevel: "LOW TO MODERATE RISK",
      riskClass: "LOW_RISK",
      confidence: 96.1,
      hazardProbabilities: [
        { name: "Stuck Pipe (Differential / Mechanical)", probability: 28, trend: "Normal range", status: "Low", color: "#16a34a" },
        { name: "Lost Circulation / Mud Loss", probability: 42, trend: "Slight permeability seepage", status: "Moderate", color: "#d97706" },
        { name: "Wellbore Instability / Sloughing Shale", probability: 31, trend: "Stable borehole caliper", status: "Low", color: "#16a34a" },
        { name: "Kick / Well Control Risk", probability: 22, trend: "No gas cut detected", status: "Low", color: "#16a34a" },
        { name: "Pore Pressure Squeeze / Tight Hole", probability: 25, trend: "Hydrostatic balanced", status: "Low", color: "#16a34a" }
      ],
      telemetryAnomalies: [
        { parameter: "Standpipe Pressure (SPP)", current: "2,650 psi", normal: "2,620 psi", delta: "+30 psi (Nominal)", alert: false },
        { parameter: "Rotary Torque", current: "15.2 kft-lb", normal: "15.0 kft-lb", delta: "Smooth rotation", alert: false },
        { parameter: "Flow Delta (Out - In)", current: "-6 gpm", normal: "0 gpm", delta: "Minor filter cake seepage", alert: false },
        { parameter: "Rate of Penetration (ROP)", current: "16.2 m/hr", normal: "16.0 m/hr", delta: "Standard drilling speed", alert: false },
        { parameter: "Equivalent Circulating Density (ECD)", current: "1.26 SG", normal: "1.25 SG", delta: "Well within envelope", alert: false }
      ],
      explanations: {
        geologicalDrivers: [
          "Tipam Sandstone formation exhibits competent matrix strength with moderate permeability (35-70 mD).",
          "Hydrostatic head maintained by 1.22 SG KCl-Polymer mud provides sufficient overbalance (1.2 ppg) without risking formation fracturing."
        ],
        offsetPrecedents: [
          "Historical Digboi offset well DGB-002 drilled through this interval with zero stuck pipe incidents and high casing retrieval success rate."
        ],
        featureImportance: [
          { feature: "Borehole Caliper Gauge Stability", weight: 38 },
          { feature: "Lithology Matrix Competency", weight: 28 },
          { feature: "Circulation Flow Consistency", weight: 18 },
          { feature: "Differential Pressure Margin", weight: 16 }
        ]
      },
      recommendedActions: [
        {
          priority: "STANDARD",
          action: "Maintain Baseline Drilling Parameters",
          detail: "Continue steady rotary drilling at 80-90 RPM with 18-20 klbs WOB. Monitor shale shaker returns for any sudden change in sand fraction.",
          category: "Routine Drilling"
        },
        {
          priority: "PREVENTIVE",
          action: "Monitor Mud Filtrate Loss (API Filter Press)",
          detail: "Keep API water loss below 6.0 cc/30min by periodically adding starch/PAC-LV polymer to active pit.",
          category: "Mud Maintenance"
        }
      ],
      parameterMatrix: [
        { parameter: "Mud Weight (SG)", current: "1.22", recommended: "1.22", safeRange: "1.20 - 1.25" },
        { parameter: "Rotary Speed (RPM)", current: "85", recommended: "85", safeRange: "75 - 95" },
        { parameter: "Weight on Bit (WOB - klbs)", current: "18", recommended: "18", safeRange: "16 - 22" },
        { parameter: "Pump Flow Rate (LPM)", current: "1,950", recommended: "1,950", safeRange: "1,850 - 2,100" }
      ],
      sopReference: "OIL/DD/NWIS/ASSAM-2024/SOP-TIPAM-12"
    }
  },
  {
    wellId: "OIL-BGJ-001",
    apiNumber: "OIL-ASM-000009",
    wellName: "Baghjan-001 (Gas/Condensate Target)",
    field: "Baghjan",
    fieldCode: "BAGH 202",
    basin: "Assam-Arakan",
    district: "Tinsukia",
    state: "Assam",
    blockName: "OALP-IV-03",
    operator: "Oil India Limited",
    targetDepthM: 2875,
    currentDepthM: 2852,
    measuredDepthM: 2906,
    trueVerticalDepthM: 2852,
    formation: "Barail Sandstone",
    formationAge: "Oligocene",
    formationTopM: 1256,
    formationBottomM: 2168,
    lithology: "Fine Sandstone with Carbonaceous Shale & Gas Caps",
    porePressurePsi: 2725.8,
    porePressurePpg: 15.96,
    fractureGradientPpg: 16.85,
    mudType: "PHPA Water-Based Mud",
    currentMudWeightSg: 1.34,
    currentMudWeightPpg: 11.18,
    rigName: "OIL Rig-14",
    spudDate: "26-Dec-2013",
    status: "Completed / Monitoring",
    riskZone: "High Risk",
    coordinates: { lat: 27.4680, lng: 95.4802 },
    offsetWellsCount: 11,
    closestOffset: {
      name: "BGJ-002",
      distanceKm: 3.2,
      direction: "North-West",
      nptIncident: "Gas influx and dynamic loss at 2,750m",
      completionDate: "23-Nov-2014"
    },
    simulation: {
      fusedScore: 84.7,
      riskLevel: "CRITICAL GAS & WELL CONTROL ALERT",
      riskClass: "HIGH_RISK",
      confidence: 97.4,
      hazardProbabilities: [
        { name: "Kick / Gas Influx Incident", probability: 89, trend: "+24% Gas units on mud logging", status: "Critical", color: "#dc2626" },
        { name: "Lost Circulation into Depleted Sand", probability: 76, trend: "Differential pressure widening", status: "Critical", color: "#dc2626" },
        { name: "Stuck Pipe (Differential Sticking)", probability: 69, trend: "Thick filter cake risk", status: "High", color: "#ea580c" },
        { name: "Wellbore Instability / Coal Sloughing", probability: 62, trend: "Cleat spalling observed", status: "High", color: "#ea580c" },
        { name: "Overpressure Blowout Potential", probability: 78, trend: "Gas bubble migration velocity high", status: "Critical", color: "#dc2626" }
      ],
      telemetryAnomalies: [
        { parameter: "Total Gas (Mud Log)", current: "1,450 units", normal: "120 units", delta: "+1,100% Extreme Kick Warning", alert: true },
        { parameter: "Pit Volume Totalizer (PVT)", current: "+14.5 bbls", normal: "0 bbls", delta: "Active Pit Gain (Gas Influx)", alert: true },
        { parameter: "Flow Out Sensor", current: "+38 gpm", normal: "0 gpm", delta: "Flow-out > Flow-in", alert: true },
        { parameter: "Standpipe Pressure (SPP)", current: "3,150 psi", normal: "3,300 psi", delta: "-150 psi (Light gas bubble)", alert: true }
      ],
      explanations: {
        geologicalDrivers: [
          "Barail Formation in Baghjan is renowned for high-pressure gas sands bounded by sealing coal beds.",
          "Extreme pore pressure gradient (15.96 ppg) has outpaced active mud weight (11.18 ppg), causing an underbalance of 4.78 ppg and triggering gas influx into the wellbore."
        ],
        offsetPrecedents: [
          "Baghjan-002 previously recorded an unexpected 35 bbl gas kick at 2,750m requiring soft shut-in and 1.45 SG kill mud circulation under choke."
        ],
        featureImportance: [
          { feature: "Mud Log Gas Units & C1-C4 Ratio", weight: 42 },
          { feature: "Active Pit Gain (PVT Indicator)", weight: 31 },
          { feature: "Differential Pressure Underbalance", weight: 17 },
          { feature: "Flow-line Sensor Discrepancy", weight: 10 }
        ]
      },
      recommendedActions: [
        {
          priority: "CRITICAL",
          action: "Execute Level-1 Well Control Shut-In (API RP 59)",
          detail: "Space out drillstring, shut down mud pumps, confirm well is flowing. Close Annular Preventer. Record Shut-In Drill Pipe Pressure (SIDPP) and Shut-In Casing Pressure (SICP) at 3-minute intervals.",
          category: "Well Control"
        },
        {
          priority: "CRITICAL",
          action: "Calculate & Mix Kill Mud Density (Wait & Weight Method)",
          detail: "Calculate required kill mud weight based on SIDPP. Anticipated kill weight is 1.48 SG (12.35 ppg). Circulate influx out through choke manifold with degasser online.",
          category: "Well Kill"
        },
        {
          priority: "OPERATIONAL",
          action: "Notify Baghjan Emergency Response Desk & DGMS",
          detail: "Transmit automated incident alert dossier to Digboi Basin HQ and Oil India Crisis Control Center as per statutory requirement.",
          category: "Compliance"
        }
      ],
      parameterMatrix: [
        { parameter: "Mud Weight (SG)", current: "1.34", recommended: "1.48", safeRange: "1.45 - 1.50" },
        { parameter: "Choke Manifold Pressure", current: "380 psi", recommended: "Hold SIDPP", safeRange: "< 850 psi" },
        { parameter: "Degasser Speed", current: "Idle", recommended: "Full Vacuum", safeRange: "Continuous" }
      ],
      sopReference: "OIL/WELL-CONTROL/BAGHJAN-REV4-2022"
    }
  },
  {
    wellId: "OIL-KMC-001",
    apiNumber: "OIL-ASM-000012",
    wellName: "Kumchai-001 (Deep Exploration)",
    field: "Kumchai",
    fieldCode: "KG 08",
    basin: "Assam-Arakan",
    district: "Tinsukia",
    state: "Assam",
    blockName: "OALP-IV-04",
    operator: "Oil India Limited",
    targetDepthM: 3323,
    currentDepthM: 3300,
    measuredDepthM: 3352,
    trueVerticalDepthM: 3300,
    formation: "Barail Sandstone",
    formationAge: "Oligocene",
    formationTopM: 1920,
    formationBottomM: 3022,
    lithology: "Interbedded Sandstone, Siltstone and High-Stress Shale",
    porePressurePsi: 4135.3,
    porePressurePpg: 15.25,
    fractureGradientPpg: 15.8,
    mudType: "Glycol-PHPA WBM",
    currentMudWeightSg: 1.35,
    currentMudWeightPpg: 11.27,
    rigName: "OIL Rig-10",
    spudDate: "19-Aug-2001",
    status: "Deep Drilling",
    riskZone: "Critical Risk",
    coordinates: { lat: 27.4164, lng: 95.4135 },
    offsetWellsCount: 9,
    closestOffset: {
      name: "KMC-002",
      distanceKm: 3.8,
      direction: "East",
      nptIncident: "Severe borehole spalling & twist-off at 3,192m",
      completionDate: "01-Jan-2014"
    },
    simulation: {
      fusedScore: 91.2,
      riskLevel: "SEVERE STRUCTURAL COLLAPSE HAZARD",
      riskClass: "HIGH_RISK",
      confidence: 98.3,
      hazardProbabilities: [
        { name: "Wellbore Instability / Spalling / Collapse", probability: 94, trend: "Caliper enlargement > 40%", status: "Critical", color: "#dc2626" },
        { name: "Mechanical Stuck Pipe / Pack-off", probability: 88, trend: "Heavy jagged cavings on shale shaker", status: "Critical", color: "#dc2626" },
        { name: "Lost Circulation in Faulted Zone", probability: 73, trend: "Sudden seepage in sub-fault block", status: "High", color: "#ea580c" },
        { name: "Pore Pressure Squeeze", probability: 81, trend: "Overburden stress 1.05 psi/ft", status: "Critical", color: "#dc2626" },
        { name: "Kick Hazard", probability: 54, trend: "Background trip gas elevated", status: "Moderate", color: "#d97706" }
      ],
      telemetryAnomalies: [
        { parameter: "Shaker Cavings Volume", current: "180 kg/hr", normal: "25 kg/hr", delta: "+620% Large angular splinters", alert: true },
        { parameter: "Overpull on Connections", current: "+48 klbs", normal: "0 klbs", delta: "Severe Tight Hole Friction", alert: true },
        { parameter: "Standpipe Pressure (SPP)", current: "3,580 psi", normal: "3,100 psi", delta: "+480 psi Partial Annular Choke", alert: true }
      ],
      explanations: {
        geologicalDrivers: [
          "Kumchai structure is intersected by regional thrust faults creating ultra-high horizontal tectonic stresses (Shmax/Shmin > 1.35).",
          "Dipping brittle shale beds in Barail are failing in shear shear due to insufficient borehole support pressure."
        ],
        offsetPrecedents: [
          "Offset well KMC-002 suffered complete drill string twist-off and 110 days NPT when trying to jar free from an identical collapsed shale bridge at 3,192m."
        ],
        featureImportance: [
          { feature: "Tectonic Horizontal Stress Anisotropy", weight: 39 },
          { feature: "Cavings Morphology Analysis", weight: 29 },
          { feature: "Connection Overpull Spike", weight: 19 },
          { feature: "BHA Annular Clearance", weight: 13 }
        ]
      },
      recommendedActions: [
        {
          priority: "IMMEDIATE",
          action: "Increase Mud Density to 1.42 SG & Boost Glycol Inhibition",
          detail: "Add 4% polyglycol shale inhibitor and weigh up mud with barite to 1.42 SG (11.85 ppg) to provide mechanical hoop stress support to borehole walls.",
          category: "Borehole Stability"
        },
        {
          priority: "IMMEDIATE",
          action: "Prohibit Static Stoppages & Back-ream with Jar Active",
          detail: "Do not leave drillstring stationary for more than 90 seconds. Keep string rotating at 45 RPM while pumping. Prepare hydraulic jars for immediate upward firing.",
          category: "Drilling Practice"
        }
      ],
      parameterMatrix: [
        { parameter: "Mud Weight (SG)", current: "1.35", recommended: "1.42", safeRange: "1.40 - 1.44" },
        { parameter: "Yield Point (lb/100ft²)", current: "16", recommended: "24", safeRange: "22 - 26" },
        { parameter: "Max Allowable Overpull", current: "50 klbs", recommended: "35 klbs", safeRange: "< 40 klbs" }
      ],
      sopReference: "OIL/DD/NWIS/ASSAM-2024/SOP-THRUST-BELT-88"
    }
  },
  {
    wellId: "OIL-LKW-001",
    apiNumber: "OIL-ASM-000004",
    wellName: "Lakwa-001 (Deep Reservoir)",
    field: "Lakwa",
    fieldCode: "LKW 04",
    basin: "Assam-Arakan",
    district: "Charaideo",
    state: "Assam",
    blockName: "PEL-ASSAM-04",
    operator: "Oil India Limited",
    targetDepthM: 3203,
    currentDepthM: 3181,
    measuredDepthM: 3210,
    trueVerticalDepthM: 3181,
    formation: "Barail Formation",
    formationAge: "Oligocene",
    formationTopM: 1969,
    formationBottomM: 2859,
    lithology: "Interbedded Sandstone and Shale",
    porePressurePsi: 3951.5,
    porePressurePpg: 15.27,
    fractureGradientPpg: 16.1,
    mudType: "Glycol-PHPA WBM",
    currentMudWeightSg: 1.33,
    currentMudWeightPpg: 11.10,
    rigName: "OIL Rig-10",
    spudDate: "11-Apr-2002",
    status: "Historical / High Hazard",
    riskZone: "High Risk",
    coordinates: { lat: 26.9290, lng: 94.7903 },
    offsetWellsCount: 16,
    closestOffset: {
      name: "LKW-002",
      distanceKm: 4.8,
      direction: "South-West",
      nptIncident: "Lost circulation at 3,050m in Kopili shale transition",
      completionDate: "16-Nov-2011"
    },
    simulation: {
      fusedScore: 72.8,
      riskLevel: "HIGH RISK - FORMATION SQUEEZE",
      riskClass: "HIGH_RISK",
      confidence: 93.8,
      hazardProbabilities: [
        { name: "Pore Pressure Squeeze & Tight Hole", probability: 78, trend: "+12% drag on trips", status: "High", color: "#ea580c" },
        { name: "Stuck Pipe Hazard", probability: 71, trend: "Pack-off risks during wiper trip", status: "High", color: "#ea580c" },
        { name: "Lost Circulation", probability: 58, trend: "Depleted sand layers", status: "Moderate", color: "#d97706" },
        { name: "Wellbore Instability", probability: 64, trend: "Reactive clay swelling", status: "High", color: "#ea580c" },
        { name: "Kick Hazard", probability: 38, trend: "Controlled", status: "Low", color: "#16a34a" }
      ],
      telemetryAnomalies: [
        { parameter: "Trip Drag (Hookload)", current: "+36 klbs", normal: "0 klbs", delta: "Tight Hole Encountered", alert: true },
        { parameter: "Mud Cake Thickness", current: "4.5 mm", normal: "1.5 mm", delta: "Thick Filter Cake Warning", alert: true }
      ],
      explanations: {
        geologicalDrivers: [
          "Lakwa Barail sands feature high differential pressure across depleted producing zones adjacent to virgin pressure shales.",
          "Thick permeable sand filter cakes induce high risk of differential sticking if drill string remains stationary across 3,100m - 3,180m."
        ],
        offsetPrecedents: [
          "LKW-002 experienced severe lost circulation followed by stuck pipe when attempting to drill through the Kopili transition without sealing pill."
        ],
        featureImportance: [
          { feature: "Differential Pressure Overbalance across Depleted Sand", weight: 36 },
          { feature: "Filter Cake Lubricity & Coefficient of Friction", weight: 27 },
          { feature: "Hookload Upward Drag Trend", weight: 21 },
          { feature: "Mud Infiltration Rate", weight: 16 }
        ]
      },
      recommendedActions: [
        {
          priority: "IMMEDIATE",
          action: "Add Lubricants and Lower Filtrate Loss",
          detail: "Add 2.5% extreme pressure (EP) drilling lubricant to reduce coefficient of friction from 0.28 to < 0.12. Control API water loss below 4.5 cc.",
          category: "Mud Chemistry"
        },
        {
          priority: "OPERATIONAL",
          action: "Avoid Prolonged Tool Face Orienting across Depleted Sand",
          detail: "Minimize stationary time while taking MWD directional survey shots. Install spiral drill collars to minimize contact surface area with borehole wall.",
          category: "Directional Drilling"
        }
      ],
      parameterMatrix: [
        { parameter: "Mud Weight (SG)", current: "1.33", recommended: "1.35", safeRange: "1.32 - 1.36" },
        { parameter: "Lubricant Content (%)", current: "0.5%", recommended: "2.5%", safeRange: "2.0% - 3.0%" },
        { parameter: "Max Static Connection Time", current: "8 min", recommended: "< 3 min", safeRange: "< 3 min" }
      ],
      sopReference: "OIL/DD/NWIS/ASSAM-2024/SOP-LAKWA-52"
    }
  },
  {
    wellId: "OIL-MRN-001",
    apiNumber: "OIL-ASM-000003",
    wellName: "Moran-001 (Directional Well)",
    field: "Moran",
    fieldCode: "MRN 03",
    basin: "Assam-Arakan",
    district: "Dibrugarh",
    state: "Assam",
    blockName: "PEL-ASSAM-03",
    operator: "Oil India Limited",
    targetDepthM: 2556,
    currentDepthM: 2541,
    measuredDepthM: 2580,
    trueVerticalDepthM: 2541,
    formation: "Tipam Formation",
    formationAge: "Miocene",
    formationTopM: 1250,
    formationBottomM: 1912,
    lithology: "Sandstone-Siltstone Sequence",
    porePressurePsi: 2337.3,
    porePressurePpg: 14.77,
    fractureGradientPpg: 15.9,
    mudType: "PHPA Water-Based Mud",
    currentMudWeightSg: 1.25,
    currentMudWeightPpg: 10.43,
    rigName: "OIL Rig-20",
    spudDate: "14-Feb-2003",
    status: "Completed",
    riskZone: "Moderate Risk",
    coordinates: { lat: 27.1964, lng: 94.8859 },
    offsetWellsCount: 15,
    closestOffset: {
      name: "MRN-002",
      distanceKm: 5.1,
      direction: "East",
      nptIncident: "Minor torque stalling on dogleg section",
      completionDate: "29-Jul-2005"
    },
    simulation: {
      fusedScore: 49.5,
      riskLevel: "MODERATE DRILLING HAZARD",
      riskClass: "MEDIUM_RISK",
      confidence: 91.5,
      hazardProbabilities: [
        { name: "Directional Key-seating & Stuck Pipe", probability: 54, trend: "Dogleg severity 3.2°/30m", status: "Moderate", color: "#d97706" },
        { name: "Wellbore Instability", probability: 48, trend: "Borehole ovalization minor", status: "Moderate", color: "#d97706" },
        { name: "Lost Circulation", probability: 36, trend: "Stable flow", status: "Low", color: "#16a34a" },
        { name: "Kick Hazard", probability: 28, trend: "No influx", status: "Low", color: "#16a34a" },
        { name: "Pore Pressure Squeeze", probability: 35, trend: "Normal pressure", status: "Low", color: "#16a34a" }
      ],
      telemetryAnomalies: [
        { parameter: "Dogleg Severity (DLS)", current: "3.4°/30m", normal: "2.5°/30m", delta: "Moderate curvature", alert: true },
        { parameter: "Rotary Torque Variance", current: "+18%", normal: "±5%", delta: "Minor key-seat drag", alert: false }
      ],
      explanations: {
        geologicalDrivers: [
          "Directional inclination reaches 15.2° across Tipam sand-silt boundaries.",
          "Keyseat formation at build section (1,600m - 1,850m) introduces mechanical drag on trip-out."
        ],
        offsetPrecedents: [
          "MRN-002 traversed similar build trajectory requiring back-reaming every 200m."
        ],
        featureImportance: [
          { feature: "Borehole Dogleg Severity (DLS)", weight: 35 },
          { feature: "Mechanical Friction Drag Factor", weight: 29 },
          { feature: "Formation Bed Dip Angle", weight: 20 },
          { feature: "Drillstring BHA Stiffness", weight: 16 }
        ]
      },
      recommendedActions: [
        {
          priority: "STANDARD",
          action: "Controlled Pull-Out with Reaming on Build Section",
          detail: "Back-ream through 1,600m - 1,850m interval at 50 RPM with pump on to eliminate key-seats before running casing.",
          category: "Tripping Practice"
        }
      ],
      parameterMatrix: [
        { parameter: "Mud Weight (SG)", current: "1.25", recommended: "1.26", safeRange: "1.24 - 1.28" },
        { parameter: "Dogleg Severity (°/30m)", current: "3.4", recommended: "< 2.8", safeRange: "< 3.0" }
      ],
      sopReference: "OIL/DD/NWIS/ASSAM-2024/SOP-DIR-28"
    }
  }
];

// Helper to look up well by ID
function getWellById(wellId) {
  return WELLS_DATA.find(w => w.wellId === wellId) || WELLS_DATA[0];
}
