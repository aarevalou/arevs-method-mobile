import { useMemo, useRef, useState } from "react";
import { Alert, PanResponder, Pressable, ScrollView, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useApp } from "../context/AppContext";
import { ActionButton, BottomSheetModal, EmptyState, Field, Screen, SelectField, styles, colors } from "../native/ui";

const makeId = () => globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
const dateLabel = (value) => new Date(`${value}T00:00:00`).toLocaleDateString("es-CL", { day: "2-digit", month: "short", year: "numeric" });
const isTurnNode = (node) => node.kind === "turn" || (!node.kind && !node.exerciseId);

function DraggableCircuitNode({ x, y, width, height, label, caption, start, goal, turn, selected, onMove, onSelect }) {
  const position = useRef({ x, y });
  const origin = useRef({ x, y });
  const size = useRef({ width, height });
  const moveRef = useRef(onMove);
  const selectRef = useRef(onSelect);
  position.current = { x, y };
  size.current = { width, height };
  moveRef.current = onMove;
  selectRef.current = onSelect;

  const panResponder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: (_, gesture) => Math.abs(gesture.dx) + Math.abs(gesture.dy) > 3,
    onPanResponderGrant: () => {
      origin.current = { ...position.current };
      selectRef.current?.();
    },
    onPanResponderMove: (_, gesture) => {
      const cellWidth = size.current.width / 13;
      const cellHeight = size.current.height / 15;
      if (!cellWidth || !cellHeight) return;
      moveRef.current({
        x: Math.max(0, Math.min(12, Math.round(origin.current.x + gesture.dx / cellWidth))),
        y: Math.max(0, Math.min(14, Math.round(origin.current.y + gesture.dy / cellHeight))),
      });
    },
    onPanResponderTerminationRequest: () => false,
  }), []);

  return (
    <View
      {...panResponder.panHandlers}
      accessible
      accessibilityRole="button"
      accessibilityLabel={start ? `${caption}. Mantén presionado y arrastra para mover.` : `${caption}. Toca para seleccionar o arrastra para mover.`}
      style={{
        position: "absolute",
        zIndex: 3,
        left: `${((x + 0.5) / 13) * 100}%`,
        top: `${((y + 0.5) / 15) * 100}%`,
        width: 96,
        height: 52,
        marginLeft: -48,
        marginTop: -16,
        alignItems: "center",
      }}
    >
      <View style={{
        width: start ? 34 : 32,
        height: start ? 34 : 32,
        borderRadius: 18,
        borderWidth: start || selected ? 2 : 1,
        borderColor: start || goal ? colors.green : selected ? colors.accent : colors.text,
        backgroundColor: start || goal ? "#19241c" : selected ? "#634d18" : colors.surface,
        alignItems: "center",
        justifyContent: "center",
      }}>
        <Text style={{ color: start || goal ? colors.green : turn ? colors.accent : colors.text, fontSize: 12, fontWeight: "900" }}>
          {start ? "▶" : goal ? "⚑" : turn ? "–" : label}
        </Text>
      </View>
      <Text numberOfLines={1} style={{ maxWidth: 96, marginTop: 2, paddingHorizontal: 5, paddingVertical: 1, borderRadius: 4, backgroundColor: colors.raised, color: colors.text, fontSize: 8, lineHeight: 12, textAlign: "center" }}>
        {caption}
      </Text>
    </View>
  );
}

export default function CircuitsPage() {
  const { state, actions } = useApp();
  const [editingCircuit, setEditingCircuit] = useState(undefined);
  const [name, setName] = useState("");
  const [nodes, setNodes] = useState([]);
  const [startPosition, setStartPosition] = useState({ x: 6, y: 0 });
  const [selectedNodeId, setSelectedNodeId] = useState("");
  const [boardSize, setBoardSize] = useState({ width: 0, height: 0 });
  const [boardInteracting, setBoardInteracting] = useState(false);
  const [finishAtStart, setFinishAtStart] = useState(false);
  const [exerciseName, setExerciseName] = useState("");
  const [editingExercise, setEditingExercise] = useState(null);
  const [comment, setComment] = useState("");
  const [comments, setComments] = useState([]);
  const [error, setError] = useState("");
  const [sessionCircuit, setSessionCircuit] = useState({});
  const [sessionFilter, setSessionFilter] = useState("");

  const sessions = useMemo(() => [...state.sessions]
    .filter((session) => state.athletes.some((athlete) => athlete.id === session.athleteId))
    .sort((a, b) => b.date.localeCompare(a.date) || (a.block ?? "").localeCompare(b.block ?? "")), [state.sessions, state.athletes]);

  const startNew = () => {
    setEditingCircuit(null);
    setName("");
    setNodes([]);
    setStartPosition({ x: 6, y: 0 });
    setSelectedNodeId("");
    setFinishAtStart(false);
    setComments([]);
    setError("");
  };
  const startEdit = (circuit) => {
    setEditingCircuit(circuit);
    setName(circuit.name);
    setNodes(circuit.nodes ?? []);
    setStartPosition(circuit.startPosition ?? { x: 6, y: 0 });
    setSelectedNodeId("");
    setFinishAtStart(Boolean(circuit.finishAtStart));
    setComments(circuit.comments ?? []);
    setError("");
  };
  const closeEditor = () => setEditingCircuit(undefined);
  const saveExercise = () => {
    const label = exerciseName.trim();
    if (!label) return;
    const exercise = editingExercise
      ? { ...editingExercise, name: label }
      : { id: makeId(), name: label };
    actions.saveExercise(exercise);
    if (!editingExercise && selectedNodeId) {
      setNodes((current) => current.map((node) => node.id === selectedNodeId ? { ...node, exerciseId: exercise.id } : node));
    } else if (!editingExercise) {
      setNodes((current) => [...current, { id: makeId(), x: 6, y: Math.min(14, current.length + 1), exerciseId: exercise.id, kind: "exercise" }]);
    }
    setExerciseName("");
    setEditingExercise(null);
  };
  const addExistingExercise = (exerciseId) => {
    if (!exerciseId) return;
    if (selectedNodeId) {
      setNodes((current) => current.map((node) => node.id === selectedNodeId ? { ...node, exerciseId } : node));
      setSelectedNodeId("");
      return;
    }
    setNodes((current) => [...current, { id: makeId(), x: 6, y: Math.min(14, current.length + 2), exerciseId, kind: "exercise" }]);
  };
  const placeNode = (x, y) => {
    const node = { id: makeId(), x, y, exerciseId: "", kind: "exercise" };
    setNodes((current) => [...current, node]);
    setSelectedNodeId(node.id);
  };
  const saveCircuit = () => {
    if (!name.trim()) {
      setError("Escribe un nombre para guardar el circuito.");
      return;
    }
    if (!nodes.length) {
      setError("Agrega al menos un nodo al recorrido.");
      return;
    }
    if (nodes.some((node, index) =>
      (finishAtStart || index !== nodes.length - 1) &&
      !isTurnNode(node) &&
      !state.exercises.some((exercise) => exercise.id === node.exerciseId)
    )) {
      setError("Asigna un ejercicio válido a cada nodo antes de guardar.");
      return;
    }
    actions.saveCircuit({
      id: editingCircuit?.id ?? makeId(),
      name: name.trim(),
      nodes,
      startPosition,
      finishAtStart,
      comments,
      gridColumns: editingCircuit?.gridColumns ?? 13,
      gridRows: editingCircuit?.gridRows ?? 15,
    });
    closeEditor();
  };
  const addComment = () => {
    if (!comment.trim()) return;
    setComments((current) => [...current, { id: makeId(), text: comment.trim() }]);
    setComment("");
  };
  const moveStart = (position) => setStartPosition(position);
  const moveSequence = (nodeId, offset) => setNodes((current) => {
    const index = current.findIndex((node) => node.id === nodeId);
    const destination = index + offset;
    if (index < 0 || destination < 0 || destination >= current.length) return current;
    const reordered = [...current];
    [reordered[index], reordered[destination]] = [reordered[destination], reordered[index]];
    return reordered;
  });
  const selectedNodeIndex = nodes.findIndex((node) => node.id === selectedNodeId);
  const selectedNode = selectedNodeIndex >= 0 ? nodes[selectedNodeIndex] : null;
  const selectedNodeIsLast = selectedNodeIndex === nodes.length - 1 && selectedNodeIndex >= 0;
  const selectedNodeIsGoal = selectedNodeIsLast && !finishAtStart;
  const toggleSelectedNodeTurn = () => {
    if (!selectedNode || selectedNodeIsGoal) return;
    setNodes((current) => current.map((node) => node.id === selectedNodeId
      ? { ...node, kind: isTurnNode(node) ? "exercise" : "turn", exerciseId: "" }
      : node));
  };
  const toggleInitialGoal = () => {
    if (!selectedNodeIsLast) return;
    const enablingInitialGoal = !finishAtStart;
    setNodes((current) => current.map((node, index) => index === current.length - 1
      ? { ...node, kind: enablingInitialGoal ? "exercise" : "goal", exerciseId: "" }
      : node));
    setFinishAtStart(enablingInitialGoal);
  };
  const removeExercise = (exercise) => {
    const inSavedCircuit = state.circuits.some((circuit) => circuit.nodes?.some((node) => node.exerciseId === exercise.id));
    const inDraft = nodes.some((node) => node.exerciseId === exercise.id);
    if (inSavedCircuit || inDraft) {
      Alert.alert("Ejercicio en uso", "Quita el ejercicio de los circuitos antes de eliminarlo.");
      return;
    }
    actions.deleteExercise(exercise.id);
  };
  const deleteCircuit = (circuit) => Alert.alert("Eliminar circuito", `Se eliminará "${circuit.name}".`, [
    { text: "Cancelar", style: "cancel" },
    { text: "Eliminar", style: "destructive", onPress: () => actions.deleteCircuit(circuit.id) },
  ]);
  const selectedSessionId = sessionFilter || sessions[0]?.id || "";

  return (
    <>
      <Screen eyebrow="Diseño y planificación" title="Circuitos" subtitle="Crea recorridos, administra ejercicios y asígnalos a sesiones">
        <ActionButton title="＋ Diseñar circuito" onPress={startNew} />
        <Text style={styles.sectionTitle}>Circuitos guardados · {state.circuits.length}</Text>
        {state.circuits.length ? state.circuits.map((circuit) => (
          <View key={circuit.id} style={styles.panel}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
              <View style={{ flex: 1, gap: 4 }}>
                <Text style={[styles.body, { fontWeight: "800" }]}>{circuit.name}</Text>
                <Text style={styles.small}>{circuit.nodes?.length ?? 0} ejercicios · meta {circuit.finishAtStart ? "en la salida" : "al final"}</Text>
              </View>
              <Pressable onPress={() => startEdit(circuit)} accessibilityRole="button" accessibilityLabel={`Editar ${circuit.name}`} hitSlop={10}><Ionicons name="create-outline" size={22} color={colors.accent} /></Pressable>
              <Pressable onPress={() => deleteCircuit(circuit)} accessibilityRole="button" accessibilityLabel={`Eliminar ${circuit.name}`} hitSlop={10}><Ionicons name="trash-outline" size={21} color={colors.red} /></Pressable>
            </View>
            {(circuit.nodes ?? []).map((node, index) => {
              const exercise = state.exercises.find((item) => item.id === node.exerciseId);
              return <Text key={node.id ?? `${circuit.id}-${index}`} style={styles.small}>{index + 1}. {node.kind === "turn" ? "Giro" : exercise?.name ?? "Ejercicio eliminado"}</Text>;
            })}
            {(circuit.comments ?? []).map((item) => <Text key={item.id} style={styles.small}>• {item.text}</Text>)}
          </View>
        )) : <EmptyState>Aún no tienes circuitos guardados. Diseña uno para asignarlo a las sesiones.</EmptyState>}

        <View style={styles.separator} />
        <Text style={styles.sectionTitle}>Sesiones de atletas · {sessions.length}</Text>
        {sessions.length ? (
          <>
            <SelectField label="Sesión" value={selectedSessionId} onValueChange={setSessionFilter} items={sessions.map((session) => {
              const athlete = state.athletes.find((item) => item.id === session.athleteId);
              return { value: session.id, label: `${dateLabel(session.date)} · ${athlete?.name ?? "Atleta"} · ${session.block ?? "—"}` };
            })} />
            {selectedSessionId ? <SelectField label="Circuito asignado" value={sessionCircuit[selectedSessionId] ?? sessions.find((item) => item.id === selectedSessionId)?.circuitId ?? ""}
              onValueChange={(value) => {
                setSessionCircuit((current) => ({ ...current, [selectedSessionId]: value }));
                actions.assignCircuitToSession(selectedSessionId, value);
              }}
              items={[{ value: "", label: "Sin circuito asignado" }, ...state.circuits.map((circuit) => ({ value: circuit.id, label: circuit.name }))]} /> : null}
          </>
        ) : <EmptyState>Registra la asistencia de una sesión para poder asignar un circuito.</EmptyState>}
      </Screen>

      <BottomSheetModal visible={editingCircuit !== undefined} onRequestClose={closeEditor}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <View style={{ gap: 3 }}><Text style={styles.eyebrow}>Diseñador de recorridos</Text><Text style={styles.modalTitle}>{editingCircuit ? "Editar circuito" : "Nuevo circuito"}</Text></View>
              <Pressable onPress={closeEditor} accessibilityRole="button" accessibilityLabel="Cerrar"><Ionicons name="close" size={25} color={colors.muted} /></Pressable>
            </View>
            <ScrollView
              keyboardShouldPersistTaps="handled"
              scrollEnabled={!boardInteracting}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ gap: 12, paddingBottom: 8 }}
            >
              <Field label="Nombre del circuito" value={name} onChangeText={setName} placeholder="Ej. Velocidad y coordinación" />
              <View style={{ gap: 7 }}>
                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                  <Text style={styles.sectionTitle}>Recorrido · {nodes.length} nodos</Text>
                  <Text style={[styles.small, { color: colors.accent }]}>Toca para agregar · arrastra para mover</Text>
                </View>
                <View
                  onLayout={(event) => setBoardSize(event.nativeEvent.layout)}
                  onTouchStart={() => setBoardInteracting(true)}
                  onTouchEnd={() => setBoardInteracting(false)}
                  onTouchCancel={() => setBoardInteracting(false)}
                  accessibilityLabel="Cuadrícula táctil de 13 columnas y 15 filas para diseñar el recorrido"
                  style={{ width: "100%", maxWidth: 338, aspectRatio: 13 / 15, alignSelf: "center", borderWidth: 7, borderColor: "#263329", borderRadius: 13, backgroundColor: "#354a37", overflow: "hidden" }}
                >
                  <View style={{ position: "absolute", inset: 0, flexDirection: "row", flexWrap: "wrap", alignContent: "flex-start" }}>
                    {Array.from({ length: 13 * 15 }, (_, index) => (
                      <Pressable
                        key={index}
                        onPress={() => placeNode(index % 13, Math.floor(index / 13))}
                        accessibilityRole="button"
                        accessibilityLabel={`Agregar nodo en columna ${index % 13 + 1}, fila ${Math.floor(index / 13) + 1}`}
                        style={({ pressed }) => [{
                          width: `${100 / 13}%`,
                          height: `${100 / 15}%`,
                          borderRightWidth: 1,
                          borderBottomWidth: 1,
                          borderColor: "rgba(255,255,255,0.13)",
                        }, pressed && { backgroundColor: "rgba(255,255,255,0.14)" }]}
                      />
                    ))}
                  </View>
                  {!nodes.length ? (
                    <View pointerEvents="none" style={{ position: "absolute", top: "49%", left: "8%", right: "8%", alignItems: "center" }}>
                      <Text style={{ color: "rgba(255,255,255,0.58)", textAlign: "center", fontSize: 11 }}>Toca una casilla para agregar el primer nodo</Text>
                    </View>
                  ) : null}
                  {boardSize.width > 0 ? (
                    <>
                      {[
                        { from: startPosition, to: nodes[0], key: "start", color: colors.accent },
                        ...nodes.slice(1).map((node, index) => ({ from: nodes[index], to: node, key: node.id, color: colors.accent })),
                        ...(finishAtStart && nodes.length ? [{ from: nodes[nodes.length - 1], to: startPosition, key: "finish", color: colors.green }] : []),
                      ].filter((line) => line.from && line.to).map(({ from, to, key, color }) => {
                        const x1 = (from.x ?? 6) + 0.5;
                        const y1 = (from.y ?? 0) + 0.5;
                        const x2 = (to.x ?? 6) + 0.5;
                        const y2 = (to.y ?? 0) + 0.5;
                        const length = Math.hypot((x2 - x1) * boardSize.width / 13, (y2 - y1) * boardSize.height / 15);
                        const angle = Math.atan2(y2 - y1, x2 - x1);
                        return <View key={key} pointerEvents="none" style={{ position: "absolute", zIndex: 1, left: `${((x1 + x2) / 2 / 13) * 100}%`, top: `${((y1 + y2) / 2 / 15) * 100}%`, width: length, height: 2, marginLeft: -length / 2, marginTop: -1, backgroundColor: color, opacity: 0.8, transform: [{ rotate: `${angle}rad` }] }} />;
                      })}
                      <DraggableCircuitNode
                        x={startPosition.x}
                        y={startPosition.y}
                        width={boardSize.width}
                        height={boardSize.height}
                        label="Inicio"
                        caption={finishAtStart ? "Inicio/Meta" : "Inicio"}
                        start
                        onMove={moveStart}
                      />
                      {nodes.map((node, index) => {
                        const exercise = state.exercises.find((item) => item.id === node.exerciseId);
                        const goal = index === nodes.length - 1 && !finishAtStart;
                        const turn = isTurnNode(node) && !goal;
                        const number = nodes.slice(0, index + 1).filter((item) => !isTurnNode(item)).length;
                        return (
                          <DraggableCircuitNode
                            key={node.id}
                            x={node.x ?? 6}
                            y={node.y ?? 0}
                            width={boardSize.width}
                            height={boardSize.height}
                            label={`${number}`}
                            caption={goal ? "Meta" : turn ? "Esquina" : exercise?.name ?? "Sin ejercicio"}
                            goal={goal}
                            turn={turn}
                            selected={selectedNodeId === node.id}
                            onSelect={() => setSelectedNodeId(node.id)}
                            onMove={(position) => setNodes((current) => current.map((item) => item.id === node.id ? { ...item, ...position } : item))}
                          />
                        );
                      })}
                    </>
                  ) : null}
                </View>
                <Text style={styles.small}>Arrastra el punto de inicio o cualquier nodo sobre la cuadrícula. Los movimientos se ajustan a las casillas.</Text>
              </View>
              <View style={[styles.panel, { padding: 12 }]}>
                <Text style={styles.small}>
                  {selectedNode
                    ? selectedNodeIsGoal
                      ? "Meta final seleccionada."
                      : isTurnNode(selectedNode)
                        ? "Esquina seleccionada."
                        : `Nodo ${selectedNodeIndex + 1} seleccionado.`
                    : "Selecciona un nodo de la cuadrícula para cambiar su tipo o la meta."}
                </Text>
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                  <ActionButton
                    title={selectedNode && isTurnNode(selectedNode) ? "Convertir en ejercicio" : "Convertir en esquina"}
                    secondary
                    onPress={toggleSelectedNodeTurn}
                    disabled={!selectedNode || selectedNodeIsGoal}
                    style={{ flexGrow: 1 }}
                  />
                  <ActionButton
                    title={finishAtStart ? "META INICIAL ACTIVADA" : "La meta está al final"}
                    secondary
                    onPress={toggleInitialGoal}
                    disabled={!selectedNodeIsLast}
                    style={{ flexGrow: 1 }}
                  />
                  <ActionButton
                    title="Eliminar nodo"
                    secondary
                    destructive
                    onPress={() => {
                      setNodes((current) => current.filter((node) => node.id !== selectedNodeId));
                      setSelectedNodeId("");
                    }}
                    disabled={!selectedNode}
                    style={{ flexGrow: 1 }}
                  />
                </View>
              </View>
              <View style={styles.panel}>
                <Text style={styles.sectionTitle}>Ejercicios</Text>
                <Text style={styles.small}>{selectedNodeId ? "Toca un ejercicio para asignarlo al nodo seleccionado." : "Crea ejercicios o toca uno para agregarlo al recorrido."}</Text>
                <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 8 }}>
                  <Field label={editingExercise ? "Editar ejercicio" : "Nuevo ejercicio"} value={exerciseName} onChangeText={setExerciseName} placeholder="Nombre del ejercicio" style={{ flex: 1 }} />
                  <ActionButton title={editingExercise ? "Guardar" : "Agregar"} onPress={saveExercise} />
                  {editingExercise ? <ActionButton title="Cancelar" secondary onPress={() => { setEditingExercise(null); setExerciseName(""); }} /> : null}
                </View>
                {state.exercises.length ? state.exercises.map((exercise) => (
                  <View key={exercise.id} style={[styles.row, { justifyContent: "space-between", minHeight: 44 }]}>
                    <Pressable onPress={() => addExistingExercise(exercise.id)} accessibilityRole="button" accessibilityLabel={`${selectedNodeId ? "Asignar" : "Agregar"} ejercicio ${exercise.name}`} style={({ pressed }) => [{ flex: 1, minHeight: 42, flexDirection: "row", alignItems: "center", gap: 9, paddingHorizontal: 10, borderRadius: 7, backgroundColor: colors.raised }, pressed && { opacity: 0.72 }]}>
                      <Ionicons name={selectedNodeId ? "checkmark-circle-outline" : "add-circle-outline"} size={20} color={colors.accent} />
                      <Text style={[styles.body, { flex: 1 }]}>{exercise.name}</Text>
                    </Pressable>
                    <Pressable onPress={() => { setEditingExercise(exercise); setExerciseName(exercise.name); }} accessibilityRole="button" accessibilityLabel={`Editar ejercicio ${exercise.name}`} hitSlop={8}><Ionicons name="create-outline" size={20} color={colors.accent} /></Pressable>
                    <Pressable onPress={() => removeExercise(exercise)} accessibilityRole="button" accessibilityLabel={`Eliminar ejercicio ${exercise.name}`} hitSlop={8}><Ionicons name="trash-outline" size={20} color={colors.red} /></Pressable>
                  </View>
                )) : <EmptyState>Aún no hay ejercicios guardados.</EmptyState>}
              </View>
              {nodes.map((node, index) => {
                const exercise = state.exercises.find((item) => item.id === node.exerciseId);
                return (
                  <View key={node.id} style={[styles.panel, { padding: 11, gap: 9, borderColor: selectedNodeId === node.id ? colors.accent : colors.border }]}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                      <Text style={[styles.body, { flex: 1, fontWeight: "700" }]}>{index + 1}. {node.kind === "turn" ? "Punto de giro" : exercise?.name ?? "Ejercicio"}</Text>
                      <Pressable onPress={() => moveSequence(node.id, -1)} accessibilityRole="button" accessibilityLabel="Subir nodo"><Ionicons name="chevron-up" size={21} color={colors.accent} /></Pressable>
                      <Pressable onPress={() => moveSequence(node.id, 1)} accessibilityRole="button" accessibilityLabel="Bajar nodo"><Ionicons name="chevron-down" size={21} color={colors.accent} /></Pressable>
                      <Pressable onPress={() => setNodes((current) => current.filter((item) => item.id !== node.id))} accessibilityRole="button" accessibilityLabel="Quitar del recorrido"><Ionicons name="close-circle-outline" size={22} color={colors.red} /></Pressable>
                    </View>
                    <Text style={styles.small}>Columna {(node.x ?? 6) + 1} · fila {(node.y ?? 0) + 1} · puedes moverlo directamente en la cuadrícula.</Text>
                  </View>
                );
              })}
              <View style={styles.panel}>
                <Text style={styles.sectionTitle}>Indicaciones</Text>
                <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 8 }}>
                  <Field label="Comentario del circuito" value={comment} onChangeText={setComment} placeholder="Escribe una indicación" style={{ flex: 1 }} />
                  <ActionButton title="Añadir" onPress={addComment} />
                </View>
                {comments.map((item) => <View key={item.id} style={[styles.row, { justifyContent: "space-between" }]}><Text style={[styles.small, { flex: 1 }]}>• {item.text}</Text><Pressable onPress={() => setComments((current) => current.filter((entry) => entry.id !== item.id))} accessibilityRole="button" accessibilityLabel="Eliminar comentario"><Ionicons name="close-circle-outline" size={20} color={colors.red} /></Pressable></View>)}
              </View>
              {error ? <Text accessibilityRole="alert" style={{ color: colors.red }}>{error}</Text> : null}
            </ScrollView>
            <View style={{ flexDirection: "row", gap: 9 }}>
              <ActionButton title="Cancelar" secondary onPress={closeEditor} style={{ flex: 1 }} />
              <ActionButton title="Guardar circuito" onPress={saveCircuit} style={{ flex: 1 }} />
            </View>
      </BottomSheetModal>
    </>
  );
}
