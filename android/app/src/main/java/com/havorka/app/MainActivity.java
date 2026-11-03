package com.havorka.app;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(RecordingBridgePlugin.class);
        super.onCreate(savedInstanceState);
    }
}
