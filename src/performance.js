const _performance = {
  /**
   * @param type { "heif" | "png" | "jpeg" }
   * */
  requestStart(type) {
    performance.mark(`request_${type}_start`);
  },
  /**
   * @param type { "heif" | "png" | "jpeg" }
   * */
  requestEnd(type) {
    performance.mark(`request_${type}_end`);

    const { duration } = performance.measure(
      "request_heif",
      `request_${type}_start`,
      `request_${type}_end`
    );

    document.getElementById(`request_${type}`).value = `${(
      duration / 1000
    ).toFixed(4)}s`;
  },
  /**
   * @param type { "heif" | "png" | "jpeg" }
   * */
  decodeStart(type) {
    performance.mark(`decode_start_${type}}`);
  },
  /**
   * @param type { "heif" | "png" | "jpeg" }
   * */
  decodeEnd(type) {
    performance.mark(`decode_end_${type}}`);

    const duration = performance
      .measure("decode_heif", `decode_start_${type}}`, `decode_end_${type}}`)
      .duration.toFixed(4);

    document.getElementById(`decode_duration_${type}`).value = `${(
      duration / 1000
    ).toFixed(4)}s`;
  },
  /**
   * @param type { "heif" | "png" | "jpeg" }
   * @param buffer { ArrayBuffer }
   * */
  measureFileSize(type, buffer) {
    const size = (buffer.byteLength / 1024 ** 2).toFixed(4);
    document.getElementById(`file_size_${type}`).value = `${size}Mb`;
  },
};
