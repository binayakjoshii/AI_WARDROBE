import numpy as np
import pandas as pd
import joblib
from pathlib import Path
from sklearn.neural_network import MLPClassifier
from sklearn.model_selection import train_test_split
from sklearn.metrics import classification_report, roc_auc_score, confusion_matrix, accuracy_score
from sklearn.preprocessing import StandardScaler
from sklearn.decomposition import PCA
from sentence_transformers import SentenceTransformer

PAIRS_CSV = Path("data/pairs.csv")
MODEL_DIR = Path("models")
MODEL_PKL = MODEL_DIR / "polyvore_weather_model_v2_staging.pkl"
REPORT_TXT = MODEL_DIR / "training_report.txt"
EMBED_MODEL = "all-MiniLM-L6-v2" # 22MB, CPU-friendly

# MLP architecture (Optimized for Small Datasets)
MLP_CONFIG = dict(
    hidden_layer_sizes=(64, 32),
    activation="relu",
    solver="lbfgs",
    alpha=0.1,        # Increased regularization to prevent overfitting on small data
    max_iter=5000,    # Increased significantly to prevent the convergence timeout
    random_state=42,
    verbose=True
)

def load_pairs():
    print("Loading pairs CSV...")
    df = pd.read_csv(PAIRS_CSV)
    print(f"{len(df)} pairs loaded [positive: {(df['label']==1).sum()} negative: {(df['label']==0).sum()}]")
    return df

def embed_items(df: pd.DataFrame, model: SentenceTransformer) -> np.ndarray:
    print("Embedding tops...")
    tops_vecs = model.encode(df["top"].tolist(), batch_size=64, show_progress_bar=True, convert_to_numpy=True)
    print("Embedding bottoms...")
    bottoms_vecs = model.encode(df["bottom"].tolist(), batch_size=64, show_progress_bar=True, convert_to_numpy=True)
    return np.hstack([tops_vecs, bottoms_vecs])

def build_features(df: pd.DataFrame, embeddings: np.ndarray) -> tuple:
    print("Compressing text embeddings using PCA...")
    # Compress the massive 1536 text dimensions down to the 50 most important features
    pca = PCA(n_components=50, random_state=42)
    compressed_embeddings = pca.fit_transform(embeddings)
    
    warmth_top = df["warmth_top"].values.reshape(-1, 1)
    warmth_bottom = df["warmth_bottom"].values.reshape(-1, 1)

    # Synthetic temperature (Guwahati distribution mean 28°C, std 8°C)
    np.random.seed(42)
    temps = np.random.normal(28, 8, len(df)).clip(5, 45)
    temp_norm = (temps / 45.0).reshape(-1, 1) # normalise to [0,1]

    # Stack the compressed features with the warmth and weather
    X = np.hstack([compressed_embeddings, warmth_top, warmth_bottom, temp_norm])
    print(f"Feature matrix shape after PCA: {X.shape}")
    return X, temps, pca

def train(X, y):
    print("\nSplitting train/test (80/20)...")
    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42, stratify=y)
    
    print("Scaling features...")
    scaler = StandardScaler()
    X_train = scaler.fit_transform(X_train)
    X_test = scaler.transform(X_test)
    
    print("Training MLP...")
    mlp = MLPClassifier(**MLP_CONFIG)
    mlp.fit(X_train, y_train)
    
    # Evaluate
    y_pred = mlp.predict(X_test)
    y_prob = mlp.predict_proba(X_test)[:, 1]
    auc = roc_auc_score(y_test, y_prob)
    acc = accuracy_score(y_test, y_pred)
    
    report = (
        f"AUC-ROC: {auc:.4f}\n"
        f"Accuracy: {acc:.4f}\n\n"
        f"Classification Report:\n{classification_report(y_test, y_pred)}\n"
        f"Confusion Matrix:\n{confusion_matrix(y_test, y_pred)}\n"
    )
    print("\n" + report)
    
    REPORT_TXT.parent.mkdir(parents=True, exist_ok=True)
    REPORT_TXT.write_text(report)
    print(f"Report saved to {REPORT_TXT}")
    return mlp, scaler, auc

def save_model(mlp, scaler, pca, embed_model_name, feature_shape):
    MODEL_DIR.mkdir(parents=True, exist_ok=True)
    bundle = {
        "mlp": mlp,
        "scaler": scaler,
        "pca": pca, # Saving PCA so main.py can compress user clothes during live inference
        "embed_model_name": embed_model_name,
        "feature_shape": feature_shape,
        "warmth_keywords": {
            "wool": 0.92, "cashmere": 0.95, "fleece": 0.88, "down": 0.96,
            "puffer": 0.90, "coat": 0.82, "jacket": 0.68, "sweater": 0.75,
            "hoodie": 0.65, "denim": 0.55, "jeans": 0.52, "chinos": 0.40,
            "cotton": 0.30, "linen": 0.12, "silk": 0.18, "polyester": 0.35,
            "shorts": 0.05, "tank": 0.08, "sleeveless": 0.06, "t-shirt": 0.20,
            "tee": 0.20, "shirt": 0.28
        }
    }
    joblib.dump(bundle, MODEL_PKL, compress=3)
    print(f"Model saved to {MODEL_PKL} ({MODEL_PKL.stat().st_size / 1024:.0f} KB)")

if __name__ == "__main__":
    df = load_pairs()
    y = df["label"].values
    
    print("\nLoading sentence transformer model...")
    embedder = SentenceTransformer(EMBED_MODEL)
    
    embeddings = embed_items(df, embedder)
    
    # Unpack the PCA object along with X and temps
    X, temps, pca_model = build_features(df, embeddings)
    
    mlp, scaler, auc = train(X, y)
    
    # Pass the PCA model into the save function
    save_model(mlp, scaler, pca_model, EMBED_MODEL, X.shape[1])
    
    print(f"\nDone! AUC = {auc:.3f}")