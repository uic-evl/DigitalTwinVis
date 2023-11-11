class Const:
    data_dir = '../data'
    twin_data = data_dir + 'digital_twin_data.csv'
    twin_ln_data = data_dir + 'digital_twin_ln_data.csv'
    model_dir = data_dir + '/models/'
    rename_dict = {
        'Dummy ID': 'id',
        'Age at Diagnosis (Calculated)': 'age',
        'Feeding tube 6m': 'FT',
        'Affected Lymph node UPPER': 'affected_nodes',
        'Aspiration rate(Y/N)': 'AS',
        'Neck boost (Y/N)': 'neck_boost',
        'Gender': 'gender',
        'Tm Laterality (R/L)': 'laterality',
        'AJCC 8th edition': 'ajcc8',
        'AJCC 7th edition':'ajcc7',
        'N_category_full': 'N-category',
        'HPV/P16 status': 'hpv',
        'Tumor subsite (BOT/Tonsil/Soft Palate/Pharyngeal wall/GPS/NOS)': 'subsite',
        'Total dose': 'total_dose',
        'Therapeutic combination': 'treatment',
        'Smoking status at Diagnosis (Never/Former/Current)': 'smoking_status',
        'Smoking status (Packs/Year)': 'packs_per_year',
        'Overall Survival (1=alive,0=dead)': 'os',
        'Dose/fraction (Gy)': 'dose_fraction',
        'Local Control (1=no control, 0=primary recurrance)': 'LC',
        'Regional Control (1=regional/nodal control,0=regional/nodal recurrance)': 'RC',
        'Locoregional Control(1=Control,0=Failure)': 'LRC',
        'Distant Control (1=no DM, 0=DM)': "DC"
    }
    
    dlt_dict = {
         'Allergic reaction to Cetuximab': 'DLT_Other',
         'Cardiological (A-fib)': 'DLT_Other',
         'Dermatological': 'DLT_Dermatological',
         'Failure to Thrive': 'DLT_Other',
         'Failure to thrive': 'DLT_Other',
         'GIT [elevated liver enzymes]': 'DLT_Gastrointestinal',
         'Gastrointestina': 'DLT_Gastrointestinal',
         'Gastrointestinal': 'DLT_Gastrointestinal',
         'General': 'DLT_Other',
         'Hematological': 'DLT_Hematological',
         'Hematological (Neutropenia)': 'DLT_Hematological',
         'Hyponatremia': 'DLT_Other',
         'Immunological': 'DLT_Other',
#          'Infection': 'DLT_Infection (Pneumonia)',
        'Infection': 'DLT_Other',
         'NOS': 'DLT_Other',
#          'Nephrological': 'DLT_Nephrological',
#          'Nephrological (ARF)': 'DLT_Nephrological',
        'Nephrological': 'DLT_Other',
         'Nephrological (ARF)': 'DLT_Other',
         'Neurological': 'DLT_Neurological',
         'Neutropenia': 'DLT_Hematological',
         'Nutritional': 'DLT_Other',
         'Pancreatitis': 'DLT_Other',
         'Pulmonary': 'DLT_Other',
#          'Respiratory (Pneumonia)': 'DLT_Infection (Pneumonia)',
#          'Sepsis': 'DLT_Infection (Pneumonia)',
        'Respiratory (Pneumonia)': 'DLT_Other',
         'Sepsis': 'DLT_Other',
         'Suboptimal response to treatment' : 'DLT_Other',
         'Vascular': 'DLT_Other'
    }
    
    decision1 = 'Decision 1 (Induction Chemo) Y/N'
    decision2 = 'Decision 2 (CC / RT alone)'
    decision3 = 'Decision 3 Neck Dissection (Y/N)'
    decisions = [decision1,decision2, decision3]
    outcomes = ['Overall Survival (4 Years)', 'FT', 'Aspiration rate Post-therapy','LRC']
    timeseries_outcomes = ['OS (Calculated)','Locoregional control (Time)','FDM (months)','time_to_event']
    timeseries_censoring = ['Overall Survival (1=alive, 0=dead)','LRC','DC']

    modification_types = {
        0: 'no_dose_adjustment',
        1: 'dose_modified',
        2: 'dose_delayed',
        3: 'dose_cancelled',
        4: 'dose_delayed_&_modified',
        5: 'regiment_modification',
#         9: 'unknown', #only one person
    }
    
    cc_types = {
        0: 'cc_none',
        1: 'cc_platinum',
        2: 'cc_cetuximab',
        3: 'cc_others',
    }
    
    primary_disease_states = ['CR Primary','PR Primary','SD Primary']
    nodal_disease_states = [t.replace('Primary','Nodal') for t in primary_disease_states]
    dlt1 = list(set(dlt_dict.values()))
    
    modifications =  list(modification_types.values())
    state2 = modifications + primary_disease_states+nodal_disease_states +dlt1 #+['No imaging 0=N,1=Y']
    
    primary_disease_states2 = [t + ' 2' for t in primary_disease_states]
    nodal_disease_states2 = [t + ' 2' for t in nodal_disease_states]
    
    #unremoved stuff because I groups all dlts less common than .05% of the data
    dlt2 = [d + ' 2' for d in dlt1]
    #Removing some wihtout enough data to evaluate
#     dlt2 = ['DLT_Gastrointestinal 2','DLT_Dermatological 2','DLT_Other 2','DLT_Neurological 2','DLT_Hematological 2']
    

    tuned_transition_models = [
        'final_transition1_model_state1_input50_dims1000_dropout0.5,0.9.pt',
        'final_transition2_model_state2_input72_dims500,500_dropout0.5,0.9.pt',
        'final_outcome_model_state1_input70_dims500,500_dropout0.5,0.9.pt'
    ]
#     tuned_transition_models = [model_dir + f for f in tuned_transition_models]
    
    tuned_decision_model = 'final_decision_model_statedecisions_input119_dims500_dropout0.5,0.9.pt'
    
    optimized_model_parameters = {
        'transition1': {'hidden_layers': [500], 'attention_heads': [5], 'embed_size': 800, 'dropout': 0.95, 'input_dropout': 0.5},
        'transition2': {'hidden_layers': [500, 500], 'attention_heads': [5, 5], 'embed_size': 800, 'dropout': 0.95, 'input_dropout': 0.5},
        'outcomes': {'hidden_layers': [500], 'attention_heads': [5], 'embed_size': 800, 'dropout': 0.95, 'input_dropout': 0.5},
        'decision': {'hidden_layers': [100, 100], 'attention_heads': [1, 1], 'embed_size': 200, 'dropout': 0.95, 'input_dropout': 0.55, 'shufflecol_chance': 0.9},
    }
    ccs = list(cc_types.values())
    state3 = ccs + primary_disease_states2 + nodal_disease_states2 + dlt2
    name_dict = {
        'pd_state1': primary_disease_states,
        'nd_state1': nodal_disease_states,
        'chemo_state1': modifications,
        'chemo_state2': ccs,
        'pd_state2': primary_disease_states2,
        'pd_state2': nodal_disease_states2,
        
    }
    
 
    stratified_train_ids = [
        5,6,8,11,13,14,15,16,17,18,21,23,24,26,27,28,32,33,37,38,39,40,
        41,42,48,49,50,51,53,55,56,57,60,64,65,67,69,71,74,75,78,79,80,
        81,82,87,88,91,94,96,99,103,109,116,119,120,121,125,148,150,
        153,178,181,183,185,186,188,191,192,193,196,197,198,200,201,
        203,204,205,206,207,210,212,213,214,216,218,219,220,221,222,
        223,225,226,229,230,231,232,233,234,235,237,238,239,240,241,
        243,244,246,247,248,249,251,252,253,255,256,257,258,259,260,
        261,262,263,265,266,269,270,273,275,276,277,278,280,281,282,
        283,285,289,2000,2002,2003,2004,2007,2008,2009,2010,2011,
        2012,2013,2014,2016,2018,2021,2022,2023,2025,2027,2028,2030,
        2033,5000,5002,5004,5005,5006,5008,5009,5010,5011,5012,5013,
        5014,5015,5016,5017,5018,5019,5021,5022,5023,5024,5025,5026,
        5027,5028,5029,5030,5031,5034,5037,5039,5041,5042,5043,5044,
        5045,5047,5050,5051,5055,5057,5058,5059,5060,5061,5062,5063,
        5064,5066,5067,5068,5069,5070,5071,5072,5073,5074,5075,5076,
        5079,5081,5083,5085,5087,5088,5089,5090,5091,5092,5094,5095,
        5096,5097,5100,5102,5104,5106,5108,5110,5111,5112,5113,5114,
        5119,10001,10002,10003,10004,10006,10008,10009,10011,10015,
        10018,10019,10020,10021,10022,10024,10025,10027,10028,10029,
        10031,10033,10034,10035,10036,10037,10039,10041,10042,
        10043,10044,10045,10047,10048,10051,10052,10053,10054,10055,
        10056,10057,10059,10060,10061,10062,10064,10065,10067,10069,
        10070,10071,10072,10073,10074,10075,10077,10078,10079,10080,
        10081,10082,10083,10085,10087,10089,10090,10093,10095,10096,
        10098,10099,10103,10107,10108,10109,10110,10111,10113,10114,
        10115,10116,10117,10118,10119,10120,10121,10124,10127,10128,
        10129,10132,10134,10136,10138,10139,10140,10141,10142,10143,
        10144,10146,10147,10148,10149,10150,10151,10152,10154,10155,
        10156,10157,10158,10159,10162,10163,10164,10167,10168,10171,
        10173,10174,10175,10181,10182,10183,10184,10185,10186,10187,
        10188,10189,10191,10192,10193,10194,10195,10196,10197,10198,
        10199,10200,10201,10202,10203,10204,10205]
    
    stratified_test_ids = [
        133,47,35,10,279,5056,5035,224,209,10063,2006,5020,271,10014,
        5080,10097,10125,10106,2032,10169,2024,286,2015,2019,10026,
        5040,236,187,10161,211,5103,10178,2026,10137,184,199,10040,
        272,68,5105,10177,228,44,242,9,5101,10104,10165,10007,10133,
        10145,10016,264,5098,10023,10050,5120,227,5118,2005,5053,10135,
        5007,10092,36,2001,5115,10005,10102,189,5036,10088,254,10130,
        10086,25,5001,5065,10084,195,5099,3,5093,10094,7,5038,10068,5032,
        202,274,45,2017,10176,217,10160,5082,10012,10017,10100,2031,77,
        10066,5078,117,10010,10170,10190,10058,5049,5086,5052,268,2029,
        5084,10105,10013,245,5048,2020,215,10046,5117,5033,267,5003,168,
        31,10049,10180,190,287,284,5054,10101,208,5077,10091,10172,288,5109,
        10126,10153,10123,5107,194,10131,10038]
