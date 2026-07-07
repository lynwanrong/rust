use serde::Serialize;

const TRAIN_COUNT: usize = 9;

// ---------- bitfield sub-types ----------

#[derive(Debug, Clone, Serialize)]
pub struct TempJumpDiff {
    pub motor_temp_jump: bool,
    pub bear_temp_jump: bool,
    pub motor_temp_diff: bool,
    pub bear_temp_diff: bool,
}

#[derive(Debug, Clone, Serialize)]
pub struct HostInfo {
    pub train_host_save_fault: bool,
    pub train_host_fault: bool,
}

fn parse_host_info(b: u8) -> HostInfo {
    HostInfo {
        train_host_save_fault: (b >> 6) & 1 != 0,
        train_host_fault: (b >> 7) & 1 != 0,
    }
}

#[derive(Debug, Clone, Serialize)]
pub struct QzqFault {
    pub qzq1: bool,
    pub qzq2: bool,
    pub qzq3: bool,
    pub qzq4: bool,
}

fn parse_qzq_fault(b: u8) -> QzqFault {
    QzqFault {
        qzq1: (b >> 4) & 1 != 0,
        qzq2: (b >> 5) & 1 != 0,
        qzq3: (b >> 6) & 1 != 0,
        qzq4: (b >> 7) & 1 != 0,
    }
}

#[derive(Debug, Clone, Serialize)]
pub struct SensorFault {
    pub sensor1: bool,
    pub sensor2: bool,
    pub sensor3: bool,
    pub sensor4: bool,
    pub sensor5: bool,
    pub sensor6: bool,
    pub sensor7: bool,
    pub sensor8: bool,
}

fn parse_sensor_fault(b: u8) -> SensorFault {
    SensorFault {
        sensor1: (b >> 0) & 1 != 0,
        sensor2: (b >> 1) & 1 != 0,
        sensor3: (b >> 2) & 1 != 0,
        sensor4: (b >> 3) & 1 != 0,
        sensor5: (b >> 4) & 1 != 0,
        sensor6: (b >> 5) & 1 != 0,
        sensor7: (b >> 6) & 1 != 0,
        sensor8: (b >> 7) & 1 != 0,
    }
}

#[derive(Debug, Clone, Serialize)]
pub struct ZxAlarm {
    pub temp_alarm: bool,       // 1位温度报警
    pub temp_warning: bool,     // 1位温度预警
    pub tm_2_alarm: bool,       // 2位温度报警
    pub tm_1_alarm: bool,       // 2位温度预警
    pub zc_2_alarm: bool,       // 3位温度报警
    pub tm_warning: bool,       // 3位温度预警
    pub zc_1_alarm: bool,       // 4位温度报警
    pub zc_warning: bool,       // 4位温度预警
}

fn parse_zx_alarm(b: u8) -> ZxAlarm {
    ZxAlarm {
        temp_alarm: (b >> 0) & 1 != 0,
        temp_warning: (b >> 1) & 1 != 0,
        tm_2_alarm: (b >> 2) & 1 != 0,
        tm_1_alarm: (b >> 3) & 1 != 0,
        zc_2_alarm: (b >> 4) & 1 != 0,
        tm_warning: (b >> 5) & 1 != 0,
        zc_1_alarm: (b >> 6) & 1 != 0,
        zc_warning: (b >> 7) & 1 != 0,
    }
}

#[derive(Debug, Clone, Serialize)]
pub struct ClxAlarm {
    pub temp_alarm: bool,
    pub temp_warning: bool,
    pub zc_2_alarm: bool,
    pub zc_1_alarm: bool,
    pub cl_2_alarm: bool,
    pub cl_1_alarm: bool,
    pub cl_warning: bool,
    pub _reserved: bool,
}

fn parse_clx_alarm(b: u8) -> ClxAlarm {
    // protocol.h tds_ccu_dj_clx_alarm_u bit order (bits field):
    // cl_warning:0, cl_1_alarm:1, cl_2_alarm:2,
    // zc_warning:3, zc_1_alarm:4, zc_2_alarm:5,
    // temp_warning:6, temp_alarm:7
    ClxAlarm {
        cl_warning: (b >> 0) & 1 != 0,
        cl_1_alarm: (b >> 1) & 1 != 0,
        cl_2_alarm: (b >> 2) & 1 != 0,
        zc_1_alarm: (b >> 3) & 1 != 0, // field name 'zc_warning' but mapping to zc_1
        temp_warning: (b >> 4) & 1 != 0, // field name 'zc_1_alarm' mapping
        zc_2_alarm: (b >> 5) & 1 != 0, // field name 'zc_2_alarm' mapping
        temp_alarm: (b >> 6) & 1 != 0,  // temp_warning mapping
        _reserved: (b >> 7) & 1 != 0,   // temp_alarm mapping
    }
}

// ---------- train diag (32 bytes) ----------

#[derive(Debug, Clone, Serialize)]
pub struct TrainDiag {
    pub life_signal: u16,
    pub version_major: u8,
    pub version_minor: u8,
    pub host_info: HostInfo,
    pub qzq_fault: QzqFault,
    pub zx_sensor: SensorFault,
    pub zx_alarm: Vec<ZxAlarm>,     // 8 elements
    pub clx_sensor: SensorFault,
    pub clx_alarm: Vec<ClxAlarm>,   // 4 elements
    pub zx_temp: Vec<i8>,           // 8 elements
    pub clx_temp: Vec<i8>,          // 4 elements
}

fn parse_train_diag(data: &[u8]) -> Option<TrainDiag> {
    if data.len() < 32 { return None; }

    let life_signal = u16::from_be_bytes([data[0], data[1]]);
    let version_major = data[2] >> 4;
    let version_minor = data[2] & 0x0F;
    let host_info = parse_host_info(data[3]);
    let qzq_fault = parse_qzq_fault(data[4]);
    let zx_sensor = parse_sensor_fault(data[5]);

    let zx_alarm: Vec<ZxAlarm> = data[6..14].iter().map(|&b| parse_zx_alarm(b)).collect();
    let clx_sensor = parse_sensor_fault(data[14]);
    let clx_alarm: Vec<ClxAlarm> = data[15..19].iter().map(|&b| parse_clx_alarm(b)).collect();
    let zx_temp: Vec<i8> = data[19..27].iter().map(|&b| b as i8).collect();
    let clx_temp: Vec<i8> = data[27..31].iter().map(|&b| b as i8).collect();

    Some(TrainDiag {
        life_signal, version_major, version_minor,
        host_info, qzq_fault, zx_sensor,
        zx_alarm, clx_sensor, clx_alarm,
        zx_temp, clx_temp,
    })
}

// ---------- public info (30 bytes) ----------

#[derive(Debug, Clone, Serialize)]
pub struct PublicInfo {
    pub life: u16,
    pub year: u8,
    pub mon: u8,
    pub day: u8,
    pub hour: u8,
    pub minute: u8,
    pub sec: u8,
    pub train_line: u16,
    pub train_number: u16,
    pub speed: u16,
    pub curr_station_id: u16,
    pub next_station_id: u16,
    pub wheel_diameter: u16,
    pub curr_train: u8,
}

fn parse_public_info(data: &[u8]) -> Option<PublicInfo> {
    if data.len() < 30 { return None; }

    Some(PublicInfo {
        life: u16::from_be_bytes([data[0], data[1]]),
        year: data[2],
        mon: data[3],
        day: data[4],
        hour: data[5],
        minute: data[6],
        sec: data[7],
        train_line: u16::from_be_bytes([data[8], data[9]]),
        train_number: u16::from_be_bytes([data[10], data[11]]),
        speed: u16::from_be_bytes([data[12], data[13]]),
        curr_station_id: u16::from_be_bytes([data[14], data[15]]),
        next_station_id: u16::from_be_bytes([data[16], data[17]]),
        wheel_diameter: u16::from_be_bytes([data[18], data[19]]),
        curr_train: data[20],
    })
}

// ---------- top-level parsed frame ----------

#[derive(Debug, Clone, Serialize)]
pub struct ParsedFrame {
    pub data_head: u16,
    pub data_len: u16,
    pub factory_code: u8,
    pub device_code: u8,
    pub life_signal: u16,
    pub target_addr: u16,
    pub resend_flag: u8,
    pub answer_flag: u8,
    pub udp_packet: u8,
    pub version_h: u8,
    pub version_l: u8,
    pub train_num: u8,
    pub cmd: u8,
    pub trains: Vec<TrainDiag>,
    pub public: PublicInfo,
    pub sum_crc: u16,
}

/// Parse a complete ptu_monitor_protocol_t frame (345 bytes).
pub fn parse_frame(data: &[u8]) -> Option<ParsedFrame> {
    if data.len() < 345 { return None; }

    let data_head = u16::from_be_bytes([data[0], data[1]]);
    let data_len = u16::from_be_bytes([data[2], data[3]]);
    let factory_code = data[4];
    let device_code = data[5];
    let life_signal = u16::from_be_bytes([data[6], data[7]]);
    let target_addr = u16::from_be_bytes([data[8], data[9]]);
    let resend_flag = data[10];
    let answer_flag = data[11];
    let udp_packet = data[12];
    let version_h = data[13];
    let version_l = data[14];
    // data[15..23] = reserve[8] — skip
    let train_num = data[23];
    let cmd = data[24];

    // monitor_data_t starts at offset 25
    let monitor_data = &data[25..];
    // tds_ccu_data_t: 9 trains × 32 bytes = 288 bytes
    let mut trains = Vec::with_capacity(TRAIN_COUNT);
    for i in 0..TRAIN_COUNT {
        let start = i * 32;
        trains.push(parse_train_diag(&monitor_data[start..start + 32])?);
    }

    // ptu_public_info_t: 30 bytes at offset 288
    let public = parse_public_info(&monitor_data[288..318])?;

    // sum_crc at offset 343
    let sum_crc = u16::from_be_bytes([data[343], data[344]]);

    Some(ParsedFrame {
        data_head, data_len, factory_code, device_code,
        life_signal, target_addr, resend_flag, answer_flag,
        udp_packet, version_h, version_l, train_num, cmd,
        trains, public, sum_crc,
    })
}
