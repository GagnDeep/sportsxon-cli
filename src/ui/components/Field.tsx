import React from "react";
import { Box, Text } from "ink";
import TextInput from "ink-text-input";

/**
 * A labelled text field that participates in a simple focus model: only the
 * focused field captures keystrokes (TextInput's own `focus` prop), and the
 * focused label is highlighted.
 */
export function Field({
  label,
  value,
  onChange,
  onSubmit,
  focused,
  placeholder,
  width = 16,
  suffix,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  onSubmit?: () => void;
  focused: boolean;
  placeholder?: string;
  width?: number;
  suffix?: string;
}): React.ReactElement {
  return (
    <Box>
      <Box width={14}>
        <Text bold={focused} color={focused ? "cyan" : undefined} dimColor={!focused}>
          {focused ? "› " : "  "}
          {label}
        </Text>
      </Box>
      <Box
        width={width}
        borderStyle="round"
        borderColor={focused ? "cyan" : "gray"}
        paddingX={1}
        height={1}
      >
        <TextInput value={value} onChange={onChange} onSubmit={onSubmit} focus={focused} placeholder={placeholder} />
      </Box>
      {suffix ? <Text dimColor> {suffix}</Text> : null}
    </Box>
  );
}

/** A read-only labelled value, styled like a Field for alignment in forms. */
export function ReadField({ label, children }: { label: string; children: React.ReactNode }): React.ReactElement {
  return (
    <Box>
      <Box width={14}>
        <Text dimColor>{"  " + label}</Text>
      </Box>
      <Box>{typeof children === "string" ? <Text>{children}</Text> : children}</Box>
    </Box>
  );
}
