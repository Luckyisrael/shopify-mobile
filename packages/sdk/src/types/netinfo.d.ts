declare module '@react-native-community/netinfo' {
  export interface NetInfoState {
    isConnected: boolean | null;
    isInternetReachable: boolean | null;
    type: string;
  }

  export default class NetInfo {
    static fetch(): Promise<NetInfoState>;
    static addEventListener(listener: (state: NetInfoState) => void): () => void;
  }
}
